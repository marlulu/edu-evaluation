from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel

from app.analysis_job_store import AnalysisJobStore
from app.content_analysis import ContentExtractionResult, EvidenceUnit, extract_content
from app.submission_manifest import download_object_keys
from app.rule_interpreter import interpret_rules
from app.config import get_settings
from app.analysis_context import AnalysisStage, AnalysisTraceEvent, RollingAnalysisContext, estimate_tokens


class JobStatus(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FileStage(BaseModel):
    file_name: str
    stage: str = "queued"
    status: str = "pending"
    message: str = ""


class AnalysisJob(BaseModel):
    id: str
    status: JobStatus
    created_at: datetime
    completed_at: datetime | None = None
    result: ContentExtractionResult | None = None
    error: str | None = None
    progress: int = 0
    file_stages: list[FileStage] = []
    queue_position: int | None = None
    assessment: str | None = None
    assessment_report: dict[str, object] | None = None
    assessment_context: dict[str, object] | None = None
    trace: list[AnalysisTraceEvent] = []
    object_keys: list[str] = []
    file_paths: list[str] = []
    rule_text: str = ""


class AnalysisJobManager:
    def __init__(self) -> None:
        self.store = AnalysisJobStore()
        self.jobs: dict[str, AnalysisJob] = {}
        for payload in self.store.load():
            try:
                job = AnalysisJob.model_validate_json(payload)
                self.jobs[job.id] = job
            except Exception:
                # A corrupt historical row must not prevent the Worker from starting.
                continue
        self.job_slots = asyncio.Semaphore(3)
        self.extract_slots = asyncio.Semaphore(2)
        self.transcription_slots = asyncio.Semaphore(1)
        self.model_slots = asyncio.Semaphore(2)
        self.tasks: dict[str, asyncio.Task[None]] = {}

    async def submit(self, object_keys: list[str], file_paths: list[str], rule_text: str = "") -> AnalysisJob:
        job = AnalysisJob(
            id=str(uuid4()),
            status=JobStatus.QUEUED,
            created_at=datetime.now(timezone.utc),
            object_keys=object_keys,
            file_paths=file_paths,
            rule_text=rule_text,
        )
        job.queue_position = sum(item.status == JobStatus.QUEUED for item in self.jobs.values()) + 1
        job.file_stages = [FileStage(file_name=key.rsplit("/", 1)[-1]) for key in (object_keys or file_paths)]
        job.trace.append(AnalysisTraceEvent(stage=AnalysisStage.MANIFEST, status="queued", request_preview=f"{len(job.file_stages)} files submitted"))
        self.jobs[job.id] = job
        self._persist(job)
        self.tasks[job.id] = asyncio.create_task(self._run(job, object_keys, file_paths, rule_text))
        return job

    async def resume_pending(self) -> None:
        for job in self.jobs.values():
            if job.status in {JobStatus.QUEUED, JobStatus.EXTRACTING}:
                job.status = JobStatus.QUEUED
                job.error = None
                job.completed_at = None
                job.trace.append(AnalysisTraceEvent(
                    stage=AnalysisStage.MANIFEST,
                    status="resumed",
                    request_preview="Worker restart: job requeued from persisted input",
                ))
                self._persist(job)
                self.tasks[job.id] = asyncio.create_task(
                    self._run(job, job.object_keys, job.file_paths, job.rule_text))

    def cancel(self, job_id: str) -> AnalysisJob | None:
        job = self.jobs.get(job_id)
        if job is None:
            return None
        if job.status in {JobStatus.COMPLETED, JobStatus.PARTIAL, JobStatus.FAILED, JobStatus.CANCELLED}:
            return job
        job.status = JobStatus.CANCELLED
        job.error = "Analysis cancelled by teacher or administrator"
        job.queue_position = None
        job.completed_at = datetime.now(timezone.utc)
        for stage in job.file_stages:
            if stage.status in {"pending", "running"}:
                stage.status = "cancelled"
                stage.stage = "cancelled"
                stage.message = "Cancelled"
        job.trace.append(AnalysisTraceEvent(
            stage=AnalysisStage.EXTRACT,
            status="cancelled",
            request_preview="Analysis cancelled by teacher or administrator",
        ))
        self._persist(job)
        task = self.tasks.pop(job_id, None)
        if task is not None:
            task.cancel()
        return job

    async def _run(self, job: AnalysisJob, object_keys: list[str], file_paths: list[str], rule_text: str) -> None:
        async with self.job_slots:
            if job.status == JobStatus.CANCELLED:
                return
            job.status = JobStatus.EXTRACTING
            job.trace.append(AnalysisTraceEvent(stage=AnalysisStage.EXTRACT, status="running"))
            job.queue_position = None
            for item in self.jobs.values():
                if item.status == JobStatus.QUEUED and item.queue_position is not None:
                    item.queue_position = max(1, item.queue_position - 1)
            for stage in job.file_stages:
                stage.stage = "downloading" if object_keys else "extracting"
                stage.status = "running"
            try:
                result = await self._extract_files(job, object_keys, file_paths)
                if job.status == JobStatus.CANCELLED:
                    return
                job.result = result
                self._persist(job)
                job.trace.append(AnalysisTraceEvent(stage=AnalysisStage.EXTRACT, status="completed", evidence_ids=[item.id for item in result.evidence[:100]], response_summary=f"{len(result.evidence)} evidence units; {len(result.warnings)} warnings"))
                transcript_evidence = [
                    item for item in result.evidence if item.modality == "audio-transcript"
                ]
                transcribed_videos = {
                    item.file_name
                    for item in transcript_evidence
                    if item.file_name.lower().endswith((".mp4", ".mov", ".avi", ".mkv"))
                }
                video_files = {
                    stage.file_name
                    for stage in job.file_stages
                    if stage.file_name.lower().endswith((".mp4", ".mov", ".avi", ".mkv"))
                }
                if video_files:
                    missing_transcripts = sorted(video_files - transcribed_videos)
                    job.trace.append(AnalysisTraceEvent(
                        stage=AnalysisStage.TRANSCRIBE,
                        status="completed" if not missing_transcripts else "partial",
                        evidence_ids=[item.id for item in transcript_evidence[:100]],
                        response_summary=(
                            f"{len(transcribed_videos)}/{len(video_files)} video audio tracks transcribed; "
                            f"{len(transcript_evidence)} timestamped transcript segments"
                            + (
                                f"; unavailable: {', '.join(missing_transcripts[:5])}"
                                if missing_transcripts else ""
                            )
                        ),
                    ))
                    self._persist(job)
                job.progress = 70
                async with self.model_slots:
                    for stage in job.file_stages:
                        if stage.status == "completed":
                            stage.stage = "ready_for_assessment"
                    job.trace.append(AnalysisTraceEvent(
                        stage=AnalysisStage.SUMMARIZE,
                        status="running",
                        request_preview=(
                            f"Compressing extracted content into a related structured JSON context; "
                            f"encoding up to four selected images as Base64 from "
                            f"{_visual_candidate_count(result)} visual evidence items"
                        ),
                    ))
                    self._persist(job)
                    job.trace.append(AnalysisTraceEvent(
                        stage=AnalysisStage.ASSESS,
                        status="running",
                        request_preview="Sending the final structured context and selected Base64 visuals to AI for rule-based analysis",
                    ))
                    job.assessment_context = _build_assessment_context(result, rule_text, job.id)
                    self._persist(job)
                    job.assessment = await self._retry(
                        job,
                        AnalysisStage.ASSESS,
                        lambda: asyncio.to_thread(_assess, result, job.assessment_context),
                    )
                    job.trace.append(AnalysisTraceEvent(
                        stage=AnalysisStage.SUMMARIZE,
                        status="completed",
                        response_summary=(
                            f"{_visual_candidate_count(result)} visual artifacts were indexed; "
                            "up to four were attached to the structured assessment request"
                        ),
                    ))
                    job.trace.append(AnalysisTraceEvent(
                        stage=AnalysisStage.ASSESS,
                        status="completed",
                        estimated_input_tokens=estimate_tokens(
                            rule_text + "".join(item.text[:800] for item in result.evidence[:40])),
                        response_summary=(
                            f"{_visual_candidate_count(result)} visual artifacts selected; "
                            f"{job.assessment[:420]}"
                        ),
                    ))
                    try:
                        job.assessment_report = _parse_assessment_report(job.assessment, result)
                    except ValueError:
                        job.assessment_report = _fallback_report(result, job.assessment)
                job.progress = 100
                job.status = JobStatus.PARTIAL if result.warnings else JobStatus.COMPLETED
            except Exception as error:
                job.status = JobStatus.FAILED
                job.error = str(error)[:300]
                for stage in job.file_stages:
                    if stage.status == "running":
                        stage.status = "failed"
                        stage.message = job.error
            finally:
                job.completed_at = datetime.now(timezone.utc)
                self._persist(job)
                self.tasks.pop(job.id, None)

    async def _extract_files(
            self, job: AnalysisJob, object_keys: list[str], file_paths: list[str]) -> ContentExtractionResult:
        sources = object_keys or file_paths
        result = ContentExtractionResult()
        if not sources:
            result.warnings.append("No submission files were provided")
            return result

        async def extract_one(index: int, source: str) -> ContentExtractionResult | None:
            stage = job.file_stages[index]

            def report_detail(message: str) -> None:
                stage.stage = "extracting"
                stage.status = "running"
                stage.message = message
                job.trace.append(AnalysisTraceEvent(
                    stage=AnalysisStage.EXTRACT,
                    status="running",
                    response_summary=f"{stage.file_name}: {message}",
                ))

            try:
                async with self.extract_slots:
                    if object_keys:
                        stage.stage = "downloading"
                        stage.message = f"Downloading {stage.file_name} from object storage"
                        job.trace.append(AnalysisTraceEvent(
                            stage=AnalysisStage.EXTRACT,
                            status="running",
                            response_summary=stage.message,
                        ))
                        directory, paths = await self._retry(
                            job,
                            AnalysisStage.EXTRACT,
                            lambda: asyncio.wait_for(
                                asyncio.to_thread(download_object_keys, [source]), timeout=120),
                        )
                        try:
                            extracted = await asyncio.wait_for(
                                asyncio.to_thread(extract_content, paths, report_detail), timeout=900)
                        finally:
                            directory.cleanup()
                    else:
                        extracted = await asyncio.wait_for(
                            asyncio.to_thread(extract_content, [source], report_detail), timeout=900)
                stage.stage = "extracted"
                stage.status = "completed"
                stage.message = f"{len(extracted.evidence)} evidence units"
                job.trace.append(AnalysisTraceEvent(
                    stage=AnalysisStage.EXTRACT,
                    status="completed",
                    evidence_ids=[item.id for item in extracted.evidence[:100]],
                    response_summary=f"{stage.file_name}: extraction completed with {len(extracted.evidence)} evidence units",
                ))
                return extracted
            except Exception as error:
                stage.stage = "failed"
                stage.status = "failed"
                stage.message = str(error)[:300]
                return None
            finally:
                completed = sum(item.status in {"completed", "failed"} for item in job.file_stages)
                job.progress = min(65, max(job.progress, int(completed / len(sources) * 65)))
                self._persist(job)

        extracted = await asyncio.gather(*(extract_one(index, source) for index, source in enumerate(sources)))
        for index, item in enumerate(extracted):
            if item is None:
                result.warnings.append(
                    f"File extraction failed: {job.file_stages[index].file_name}: {job.file_stages[index].message}")
                continue
            result.evidence.extend(item.evidence)
            result.warnings.extend(item.warnings)
        return result

    def get(self, job_id: str) -> AnalysisJob | None:
        return self.jobs.get(job_id)

    def _persist(self, job: AnalysisJob) -> None:
        self.store.save(job.id, job.model_dump_json())

    async def _retry(self, job: AnalysisJob, stage: AnalysisStage, operation, attempts: int = 3):
        for attempt in range(1, attempts + 1):
            try:
                return await operation()
            except Exception as error:
                if attempt == attempts or not _is_transient_error(error):
                    raise
                job.trace.append(AnalysisTraceEvent(
                    stage=stage,
                    status="retrying",
                    request_preview=f"Transient failure, retry {attempt}/{attempts - 1}: {str(error)[:160]}",
                ))
                self._persist(job)
                await asyncio.sleep(2 ** (attempt - 1))


analysis_jobs = AnalysisJobManager()


def _build_assessment_context(
        result: ContentExtractionResult,
        rule_text: str,
        submission_id: str | None = None,
) -> dict[str, object]:
    """Build the stable, file-associated payload supplied to the assessment model."""
    files_by_name: dict[str, dict[str, object]] = {}
    artifact_sources: set[tuple[str, str | None]] = set()
    evidence_references = _evidence_references(result.evidence)
    selected_visual_ids = {item.id for item, _ in _visual_inputs(result.evidence)[:4]}
    text_budget = 120_000
    remaining_text = text_budget

    def file_entry(file_name: str) -> dict[str, object]:
        entry = files_by_name.get(file_name)
        if entry is None:
            entry = {
                "fileName": file_name,
                "contentType": mimetypes.guess_type(file_name)[0] or "application/octet-stream",
                "mediaType": _context_media_type(file_name),
                "_textParts": [],
                "artifacts": [],
            }
            files_by_name[file_name] = entry
        return entry

    for item in result.evidence:
        root_file, source_path = _context_source(item)
        entry = file_entry(root_file)
        artifact_sources.add((root_file, source_path))
        text = item.text.strip() or _compact_metadata(item.metadata)
        if text:
            excerpt = text[:6000]
            if remaining_text > 0:
                excerpt = excerpt[:remaining_text]
                prefix = f"[{evidence_references[item.id]}]"
                if source_path:
                    prefix += f" [ARCHIVE_FILE: {source_path}]"
                entry["_textParts"].append(
                    f"{prefix} {_context_locator(item.locator, source_path)}\n{excerpt}")
                remaining_text -= len(excerpt)
        entry["artifacts"].append(_context_artifact(
            item,
            len(entry["artifacts"]) + 1,
            source_path,
            item.id in selected_visual_ids,
            evidence_references[item.id],
        ))

    for member in result.archive_members:
        archive = str(member.get("archive") or "archive")
        source_path = str(member.get("memberPath") or "") or None
        if (archive, source_path) in artifact_sources:
            continue
        entry = file_entry(archive)
        artifact_index = len(entry["artifacts"]) + 1
        member_name = Path(source_path or archive).name
        entry["artifacts"].append({
            "artifactRef": f"{{fileRef}}-ARTIFACT-{artifact_index:03d}",
            "artifactType": "archive-member",
            "title": f"[{source_path or member_name}] Archive member",
            "sourcePath": source_path,
            "artifactFileName": member_name,
            "contentType": mimetypes.guess_type(member_name)[0] or "application/octet-stream",
            "hasBinaryContent": True,
            "aiPayloadStatus": "UNAVAILABLE" if member.get("status") == "failed" else "INDEXED",
            "extractionStatus": member.get("status", "unknown"),
        })

    members_by_archive: dict[str, list[str]] = {}
    for member in result.archive_members:
        archive = str(member.get("archive") or "archive")
        member_path = str(member.get("memberPath") or "")
        if member_path:
            members_by_archive.setdefault(archive, []).append(member_path)
    for archive, member_paths in members_by_archive.items():
        if remaining_text <= 0:
            break
        listing = "\n".join(f"- {member_path}" for member_path in member_paths)
        archive_text = (
            "[ARCHIVE_CLASSIFICATION]\n"
            f"Archive: {archive}\n"
            f"Recognized as a multi-file submission with {len(member_paths)} members.\n"
            f"Archive member list:\n{listing}"
        )[:remaining_text]
        file_entry(archive)["_textParts"].insert(0, archive_text)
        remaining_text -= len(archive_text)

    files: list[dict[str, object]] = []
    for index, entry in enumerate(files_by_name.values(), 1):
        file_ref = f"FILE-{index:03d}"
        artifacts = entry.pop("artifacts")
        for artifact in artifacts:
            artifact["artifactRef"] = str(artifact["artifactRef"]).format(fileRef=file_ref)
        text_parts = entry.pop("_textParts")
        entry.update({
            "fileRef": file_ref,
            "parsedText": "\n\n".join(text_parts),
            "artifacts": artifacts,
        })
        files.append(entry)

    assignment_requirements, scoring_rules = _split_rule_text(rule_text)
    return {
        "formatVersion": "submission-context-v2",
        "submissionId": submission_id,
        "studentComment": None,
        "fileCount": len(files),
        "associationRule": (
            "Each parsedText and artifacts array belongs only to its file object. "
            "For archive artifacts, sourcePath is the authoritative path of the internal source file."
        ),
        "textBudgetChars": text_budget,
        "assessmentRules": {
            "assignmentRequirements": assignment_requirements,
            "scoringRules": scoring_rules,
            "scoringRuleInterpretation": interpret_rules(scoring_rules).model_dump(),
            "rubricMode": "provided" if _has_explicit_score_allocations(scoring_rules) else "ai_generated",
        },
        "files": files,
        "warnings": result.warnings,
    }


def _split_rule_text(rule_text: str) -> tuple[str, str]:
    """Keep scope constraints separate from the rubric that determines points."""
    requirements_marker = "Assignment requirements:"
    scoring_marker = "Scoring rubric:"
    requirements = ""
    scoring = ""
    if requirements_marker in rule_text:
        requirements = rule_text.split(requirements_marker, 1)[1]
        if scoring_marker in requirements:
            requirements, scoring = requirements.split(scoring_marker, 1)
    elif scoring_marker in rule_text:
        scoring = rule_text.split(scoring_marker, 1)[1]
    else:
        scoring = rule_text
    return requirements.strip(), scoring.strip()


def _has_explicit_score_allocations(scoring_rules: str) -> bool:
    return bool(re.search(r"\b\d+(?:\.\d+)?\s*(?:points?|分)\b", scoring_rules, re.IGNORECASE))


def _context_source(item: EvidenceUnit) -> tuple[str, str | None]:
    if "!/" in item.locator:
        archive, member_locator = item.locator.split("!/", 1)
        return archive, member_locator.split("!/", 1)[0].split("#", 1)[0]
    return item.file_name, None


def _context_media_type(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".zip":
        return "archive"
    if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return "image"
    if suffix in {".mp4", ".mov", ".avi", ".mkv"}:
        return "video"
    if suffix in {".mp3", ".wav", ".m4a"}:
        return "audio"
    if suffix in {".txt", ".md"}:
        return "text"
    if suffix in {".pdf", ".docx", ".pptx", ".xlsx"}:
        return "document"
    return "unsupported"


def _context_artifact(
        item: EvidenceUnit,
        artifact_index: int,
        source_path: str | None,
        selected_for_ai: bool,
        evidence_reference: str,
) -> dict[str, object]:
    binary_modalities = {"image", "video-frame", "pdf-page-image", "word-embedded-image", "slide-image"}
    is_binary = item.modality in binary_modalities
    source_name = Path(source_path or item.file_name).name
    artifact_name = _context_artifact_file_name(source_name, item.modality, is_binary)
    locator = _context_locator(item.locator, source_path)
    return {
        "artifactRef": f"{{fileRef}}-ARTIFACT-{artifact_index:03d}",
        "artifactType": item.modality,
        "title": f"[{source_path or source_name}] {item.modality}",
        "sourcePath": source_path,
        "artifactFileName": artifact_name,
        "contentType": (
            mimetypes.guess_type(artifact_name)[0] or "image/jpeg"
        ) if is_binary else "text/plain; charset=UTF-8",
        "hasBinaryContent": is_binary,
        "aiPayloadStatus": (
            "SELECTED_FOR_AI" if selected_for_ai else "INDEXED"
        ) if is_binary else "INCLUDED_IN_PARSED_TEXT",
        "evidenceId": evidence_reference,
        "locator": locator,
    }


def _evidence_references(evidence: list[EvidenceUnit]) -> dict[str, str]:
    return {item.id: f"E{index:03d}" for index, item in enumerate(evidence, 1)}


def _context_artifact_file_name(source_name: str, modality: str, is_binary: bool) -> str:
    if is_binary:
        return source_name
    if modality in {"text-document", "text-section"}:
        return source_name
    return f"{Path(source_name).stem}-{modality}.txt"


def _context_locator(locator: str, source_path: str | None) -> str:
    if not source_path:
        return locator
    timestamp = locator[locator.find("#"):] if "#" in locator else ""
    return f"{source_path}{timestamp}"


def _assess(
        result: ContentExtractionResult,
        assessment_context: dict[str, object] | str,
) -> str:
    settings = get_settings()
    if not settings.model_api_base_url or not settings.model_api_key or not settings.text_model_name:
        return "Pending teacher review. AI model configuration is unavailable."
    from openai import OpenAI
    if isinstance(assessment_context, str):
        assessment_context = _build_assessment_context(result, assessment_context)
    context_json = json.dumps(assessment_context, ensure_ascii=False)
    evidence_references = _evidence_references(result.evidence)
    client = OpenAI(api_key=settings.model_api_key, base_url=settings.model_api_base_url)
    model_name = settings.multimodal_model_name or settings.vision_model_name or settings.text_model_name
    prompt = f"""Structured assessment context JSON:
{context_json}
The JSON is the complete textual evidence set. Its files[].parsedText and
files[].artifacts are associated only with the enclosing file; archive artifact
sourcePath identifies the actual internal file being assessed. Attached images
are the selected compressed Base64 visual artifacts described by the JSON.
Return JSON only: {{"status":"pending_review","completeness":{{"complete":true,"missing":[]}},"ruleScore":null,"aiQualityReferenceScore":0,"generatedRubric":[{{"criterion":"","description":"","maxPoints":0,"source":"provided|ai_generated"}}],"scoreBreakdown":[{{"criterion":"","rule":"","maxPoints":0,"awardedPoints":0,"deductedPoints":0,"deductionReason":"","evidenceIds":[]}}],"strengths":[{{"rule":"","aspect":"","reason":"","evidenceIds":[]}}],"deductions":[{{"criterion":"","deductedPoints":0,"reason":"","evidenceIds":[]}}],"qualityFindings":[{{"aspect":"","impact":"none|minor|material|critical","reason":"","details":"","evidenceIds":[]}}],"guidance":[{{"priority":"high|medium|low","target":"","action":"","rationale":"","expectedImprovement":"","evidenceIds":[]}}],"suggestions":[]}}.
All fields are required. Set aiQualityReferenceScore to an integer from 0 to 100.
assessmentRules.assignmentRequirements defines the permitted implementation scope. Check compliance and report scope issues. Score only from assessmentRules.scoringRules. When assessmentRules.rubricMode is "provided", mirror its explicit criteria and allocations in generatedRubric with source "provided". When rubricMode is "ai_generated", first write a concrete generatedRubric from the assignmentRequirements and scoringRules: it must have practical, observable criteria, total exactly 100 points, and source "ai_generated" for every item. Then use that generatedRubric as the only basis for scoreBreakdown. Only keep ruleScore null when both assignmentRequirements and scoringRules are empty.
For every generatedRubric criterion, return one matching scoreBreakdown item with the same maxPoints, awardedPoints, deductedPoints, exact deduction reason, and evidence IDs. awardedPoints plus deductedPoints must equal maxPoints. ruleScore must equal the sum of awardedPoints.
For every strength, cite the satisfied rule or requirement, explain why it is met, and link source evidence IDs.
Treat text-section evidence as structured document content. When it supports a finding or guidance, cite its evidence ID and paragraph locator rather than making an unlocated document-level claim.
When recognized code from an image is relevant to the assignment requirements or scoring rubric, assess its visible structure, correctness, and quality. Cite the image-code evidence ID, state uncertainty when OCR may have altered a token, and never invent code that is not present in the recognized evidence.
For source-code evidence, perform a concrete code review whenever it is relevant: inspect structure, semantic HTML, CSS reuse and responsiveness, naming, duplication, maintainability, correctness, unsafe assumptions, and compliance with the assignment requirements. Every code finding and guidance item must cite its source-code evidence ID and target the exact sourcePath plus #Lstart-Lend locator. Explain the observed code pattern, the concrete issue, the change to make, and the expected effect. Do not report generic code-style advice without a locatable source-code finding.
Act first as a strict assessor: identify content strengths and weaknesses in theme, narrative, originality, technical execution, visual/audio quality, and presentation where evidence exists.
For every video, assess the synchronized audio evidence together with its keyframes: use the timestamped transcript to assess narration or voiceover content, whether spoken content supports the visual presentation, and any mismatch with visible content. Use speech-rhythm and audio-quality evidence only for supported observations about pacing, pauses, clarity, volume, or sound quality. Cite the corresponding timestamped audio evidence IDs or video-window evidence IDs. Do not infer a missing transcript or penalize a video solely because transcription was unavailable.
Then act as a revision mentor: provide prioritized, concrete guidance. Every guidance item must name the target file, page, slide, image, timestamp, or evidence ID; specify the exact change; explain why; and state the expected improvement. Avoid generic advice such as "improve quality".
Use the supplied visual evidence as evidence and link observations to their evidence IDs."""
    content: list[dict[str, object]] = [{"type": "input_text", "text": prompt}]
    for item, image_url in _visual_inputs(result.evidence)[:4]:
        _, source_path = _context_source(item)
        content.append({
            "type": "input_text",
            "text": f"Visual evidence [{evidence_references[item.id]}] at "
                    f"{_context_locator(item.locator, source_path)}:",
        })
        content.append({"type": "input_image", "image_url": image_url, "detail": "low"})
    return _stream_response_text(client, model_name, content)


def _image_code_context(evidence: list[EvidenceUnit]) -> str:
    snippets: list[str] = []
    for item in evidence:
        if item.modality != "image-code" or not item.text.strip():
            continue
        source_id = item.metadata.get("sourceEvidenceId", "unknown-image")
        snippets.append(
            f"[{item.id}] source={source_id}; locator={item.locator}\n{item.text[:3000]}"
        )
    return "\n\n".join(snippets[:12])


def _summarize_visual_batches(client, model_name: str, result: ContentExtractionResult) -> list[str]:
    """Analyze every usable visual artifact in bounded batches before final scoring."""
    inputs = _visual_inputs(result.evidence)
    batches = [inputs[start:start + 4] for start in range(0, len(inputs), 4)]

    def summarize_batch(batch_number: int, batch: list[tuple[EvidenceUnit, str]]) -> tuple[int, str | None, str | None]:
        file_context = _visual_batch_file_context(result.evidence, batch)
        content: list[dict[str, object]] = [{
            "type": "input_text",
            "text": (
                f"Analyze visual evidence batch {batch_number}. For each image, return a compact "
                "plain-text record containing its evidence ID, visible text, visual subject, "
                "clarity/composition observations, and any rule-relevant issue. "
                "Use the related file text below to interpret the images, but do not invent details. "
                "Do not score the submission and do not describe images not included in this batch.\n"
                f"Related file text:\n{file_context}"
            ),
        }]
        for item, image_url in batch:
            content.append({"type": "input_text", "text": f"Evidence [{item.id}] at {item.locator}:"})
            content.append({"type": "input_image", "image_url": image_url, "detail": "low"})
        try:
            summary = _stream_response_text(client, model_name, content)
            if summary.strip():
                return batch_number, f"Visual batch {batch_number} ({len(batch)} images): {summary[:2400]}", None
        except Exception as error:
            return batch_number, None, f"Visual batch {batch_number} could not be analyzed: {str(error)[:200]}"
        return batch_number, None, None

    if not batches:
        return []

    with ThreadPoolExecutor(max_workers=min(2, len(batches))) as executor:
        outcomes = list(executor.map(
            lambda item: summarize_batch(item[0], item[1]),
            enumerate(batches, 1),
        ))

    summaries: list[str] = []
    for _, summary, warning in sorted(outcomes):
        if summary is not None:
            summaries.append(summary)
        if warning is not None:
            result.warnings.append(warning)
    return summaries


def _structured_text_context(evidence: list[EvidenceUnit], max_characters: int = 9000) -> str:
    """Select compact, locatable document sections for the final assessment request."""
    selected: list[str] = []
    used = 0
    for item in evidence:
        if item.modality != "text-section" or not item.text.strip():
            continue
        heading = str(item.metadata.get("heading") or "Untitled section")
        section = f"[{item.id}] {item.locator} | {heading}\n{item.text[:1200]}"
        if used + len(section) > max_characters:
            break
        selected.append(section)
        used += len(section) + 1
    return "\n".join(selected)


def _visual_batch_file_context(
        evidence: list[EvidenceUnit], batch: list[tuple[EvidenceUnit, str]]) -> str:
    """Keep image interpretation grounded in compact text from the same source files."""
    file_names = {item.file_name for item, _ in batch}
    excerpts = [
        f"[{item.id}] {item.text[:500]}"
        for item in evidence
        if item.file_name in file_names
        and item.modality not in {"image", "video-frame", "pdf-page-image", "word-embedded-image", "slide-image"}
        and item.text.strip()
    ]
    return "\n".join(excerpts)[:2400] or "(No extractable text from the related files.)"


def _visual_inputs(evidence: list[EvidenceUnit]) -> list[tuple[EvidenceUnit, str]]:
    inputs: list[tuple[EvidenceUnit, str]] = []
    for item in evidence:
        if item.modality not in {"image", "video-frame", "pdf-page-image", "word-embedded-image", "slide-image"}:
            continue
        object_key = item.metadata.get("artifactObjectKey")
        if not isinstance(object_key, str):
            continue
        image_url = _artifact_data_url(object_key)
        if image_url:
            inputs.append((item, image_url))
    return inputs


def _stream_response_text(client, model_name: str, content: list[dict[str, object]]) -> str:
    stream = client.responses.create(
        model=model_name,
        input=[{"role": "user", "content": content}],
        stream=True,
        store=True,
    )
    return "".join(event.delta for event in stream if event.type == "response.output_text.delta")


def _compact_metadata(metadata: dict[str, object]) -> str:
    keys = (
        "visualSummary", "durationSeconds", "videoStreams", "audioStreams",
        "formulaCount", "chartCount", "tableCount", "imageCount",
        "charactersPerMinute", "longPauseCount", "longestPauseSeconds",
        "rms", "peak",
    )
    values = {key: metadata[key] for key in keys if key in metadata}
    return f"Metadata: {json.dumps(values, ensure_ascii=False)}" if values else ""


def _parse_assessment_report(raw: str, result: ContentExtractionResult) -> dict[str, object]:
    candidate = raw.strip()
    if candidate.startswith("```"):
        candidate = candidate.split("\n", 1)[-1]
        candidate = candidate.rsplit("```", 1)[0].strip()
    if not candidate.startswith("{"):
        start, end = candidate.find("{"), candidate.rfind("}")
        if start >= 0 and end > start:
            candidate = candidate[start:end + 1]
    payload = json.loads(candidate)
    if not isinstance(payload, dict):
        raise ValueError("Assessment response is not an object")
    _normalize_assessment_fields(payload)
    report = _fallback_report(result, raw)
    report.update(payload)
    report["status"] = "pending_review"
    report["completeness"] = report.get("completeness") if isinstance(
        report.get("completeness"), dict) else _fallback_report(result, raw)["completeness"]
    for key in ("generatedRubric", "scoreBreakdown", "strengths", "deductions", "qualityFindings", "guidance", "suggestions"):
        if not isinstance(report.get(key), list):
            report[key] = []
    if not isinstance(report.get("aiQualityReferenceScore"), (int, float)):
        report["aiQualityReferenceScore"] = None
    return report


def _normalize_assessment_fields(report: dict[str, object]) -> None:
    aliases = {
        "rule_score": "ruleScore",
        "score": "ruleScore",
        "ai_quality_reference_score": "aiQualityReferenceScore",
        "quality_score": "aiQualityReferenceScore",
        "score_breakdown": "scoreBreakdown",
        "rubric_breakdown": "scoreBreakdown",
        "advantages": "strengths",
        "highlights": "strengths",
        "quality_findings": "qualityFindings",
        "weaknesses": "qualityFindings",
        "improvements": "suggestions",
        "recommendations": "suggestions",
        "advice": "suggestions",
    }
    for source, target in aliases.items():
        if target not in report and source in report:
            report[target] = report[source]

    evaluation = report.get("evaluation")
    if isinstance(evaluation, dict):
        for source, target in (
            ("totalScore", "aiQualityReferenceScore"),
            ("total_score", "aiQualityReferenceScore"),
            ("weaknesses", "qualityFindings"),
            ("suggestions", "suggestions"),
        ):
            if target not in report and source in evaluation:
                report[target] = evaluation[source]

    findings = report.get("qualityFindings")
    if isinstance(findings, list):
        report["qualityFindings"] = [
            item if isinstance(item, dict) else {
                "impact": "material",
                "reason": str(item),
                "evidenceIds": [],
            }
            for item in findings
            if str(item).strip()
        ]
    strengths = report.get("strengths")
    if isinstance(strengths, list):
        report["strengths"] = [
            item if isinstance(item, dict) else {
                "rule": "规则符合项",
                "reason": str(item),
                "evidenceIds": [],
            }
            for item in strengths
            if str(item).strip()
        ]
    suggestions = report.get("suggestions")
    if isinstance(suggestions, str):
        report["suggestions"] = [suggestions]


def _fallback_report(result: ContentExtractionResult, raw: str) -> dict[str, object]:
    findings = [
        {
            "impact": "material",
            "reason": warning,
            "evidenceIds": [],
        }
        for warning in result.warnings[:20]
    ]
    return {
        "status": "pending_review",
        "completeness": {"complete": not result.warnings, "missing": []},
        "ruleScore": None,
        "aiQualityReferenceScore": None,
        "generatedRubric": [],
        "scoreBreakdown": [],
        "strengths": [],
        "deductions": [],
        "qualityFindings": findings,
        "guidance": [],
        "suggestions": (
            ["请教师根据文件解析告警核对提交完整性。"] if result.warnings
            else ["请教师确认 AI 分析结果后发布。"]
        ),
        "rawText": raw,
    }


def _visual_candidate_count(result: ContentExtractionResult) -> int:
    return sum(
        isinstance(item.metadata.get("artifactObjectKey"), str)
        and item.modality in {"image", "video-frame", "pdf-page-image", "word-embedded-image", "slide-image"}
        for item in result.evidence
    )


def _artifact_data_url(object_key: str) -> str | None:
    """Return a bounded MinIO artifact as an inline Responses API image input."""
    try:
        from app.config import get_settings
        from minio import Minio

        settings = get_settings()
        if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
            return None
        client = Minio(
            settings.minio_endpoint.replace("http://", "").replace("https://", ""),
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        response = client.get_object(settings.minio_bucket, object_key)
        try:
            payload = response.read(2 * 1024 * 1024 + 1)
        finally:
            response.close()
            response.release_conn()
        if not payload or len(payload) > 2 * 1024 * 1024:
            return None
        return f"data:image/jpeg;base64,{base64.b64encode(payload).decode('ascii')}"
    except Exception:
        return None


def _is_transient_error(error: Exception) -> bool:
    message = str(error).lower()
    return isinstance(error, (TimeoutError, ConnectionError, OSError)) or any(
        marker in message
        for marker in ("timeout", "timed out", "connection", "temporarily", "rate limit", "429", "502", "503", "504")
    )
