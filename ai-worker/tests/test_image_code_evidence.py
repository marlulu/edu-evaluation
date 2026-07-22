from app.analysis_jobs import _build_assessment_context, _image_code_context
from app.content_analysis import (
    ContentExtractionResult,
    EvidenceUnit,
    _archive_member_name,
    extract_content,
    is_code_like_text,
)
from zipfile import ZipInfo


def test_detects_code_like_ocr_text() -> None:
    assert is_code_like_text("def total(values):\n    return sum(values)")
    assert is_code_like_text("const score = items.map(item => item.value);")
    assert not is_code_like_text("课堂作品展示，主题是环境保护。")


def test_image_code_context_keeps_source_evidence_and_locator() -> None:
    context = _image_code_context([
        EvidenceUnit(
            id="video.mp4:frame:2:code",
            file_name="video.mp4",
            modality="image-code",
            locator="video.mp4#t=30s#code",
            text="function add(a, b) { return a + b; }",
            metadata={"sourceEvidenceId": "video.mp4:frame:2"},
        )
    ])

    assert "[video.mp4:frame:2:code]" in context
    assert "source=video.mp4:frame:2" in context
    assert "function add" in context


def test_extraction_reports_detailed_progress(tmp_path) -> None:
    submission = tmp_path / "notes.md"
    submission.write_text("# Notes\nStructured content", encoding="utf-8")
    updates: list[str] = []

    extract_content([str(submission)], updates.append)

    assert any("Starting extraction" in update for update in updates)
    assert any("Reading structured text" in update for update in updates)


def test_assessment_context_groups_archive_members_under_the_archive_file() -> None:
    result = ContentExtractionResult(
        archive_members=[{
            "archive": "submission.zip",
            "memberPath": "src/main.py",
            "extension": ".py",
            "status": "completed",
        }]
    )

    context = _build_assessment_context(result, "Score code quality")

    assert context["formatVersion"] == "submission-context-v2"
    assert context["fileCount"] == 1
    artifact = context["files"][0]["artifacts"][0]
    assert context["files"][0]["fileName"] == "submission.zip"
    assert artifact["sourcePath"] == "src/main.py"
    assert artifact["artifactType"] == "archive-member"


def test_assessment_context_keeps_archive_evidence_with_its_source_path() -> None:
    result = ContentExtractionResult(evidence=[
        EvidenceUnit(
            id="source:text",
            file_name="archive-member-001.txt",
            modality="text-document",
            locator="submission.zip!/src/main.py!/archive-member-001.txt",
            text="print('hello')",
        ),
    ])

    context = _build_assessment_context(result, "")

    file = context["files"][0]
    assert file["fileName"] == "submission.zip"
    assert "[ARCHIVE_FILE: src/main.py]" in file["parsedText"]
    assert file["artifacts"][0]["sourcePath"] == "src/main.py"


def test_assessment_context_separates_scope_requirements_from_scoring_rules() -> None:
    context = _build_assessment_context(
        ContentExtractionResult(),
        "Assignment requirements:\nBuild a console application.\n\nScoring rubric:\nCorrectness 60 points",
    )

    rules = context["assessmentRules"]
    assert rules["assignmentRequirements"] == "Build a console application."
    assert rules["scoringRules"] == "Correctness 60 points"
    assert rules["rubricMode"] == "provided"


def test_assessment_context_requests_ai_generated_rubric_without_point_allocations() -> None:
    context = _build_assessment_context(
        ContentExtractionResult(),
        "Assignment requirements:\nBuild a console application.\n\nScoring rubric:\nUse HTML and CSS correctly.",
    )

    assert context["assessmentRules"]["rubricMode"] == "ai_generated"


def test_archive_member_name_recovers_legacy_gbk_file_names() -> None:
    member = ZipInfo("学生管理系统/登录.png".encode("gbk").decode("cp437"))

    assert _archive_member_name(member) == "学生管理系统/登录.png"


def test_source_code_extraction_keeps_line_ranges(tmp_path) -> None:
    source = tmp_path / "index.html"
    source.write_text("<main>\n<h1>Hello</h1>\n</main>\n", encoding="utf-8")

    result = extract_content([str(source)])

    assert len(result.evidence) == 1
    assert result.evidence[0].modality == "source-code"
    assert result.evidence[0].locator.endswith("#L1-L3")
    assert result.evidence[0].metadata["language"] == "html"


def test_audio_transcript_is_a_text_artifact_not_an_uploaded_video() -> None:
    result = ContentExtractionResult(evidence=[
        EvidenceUnit(
            id="video:audio:1",
            file_name="archive-member.mp4",
            modality="audio-transcript",
            locator="submission.zip!/视频讲解/视频讲解.mp4!/archive-member.mp4#t=1-2",
            text="这是视频讲解的转录文本。",
        ),
    ])

    artifact = _build_assessment_context(result, "")["files"][0]["artifacts"][0]

    assert artifact["sourcePath"] == "视频讲解/视频讲解.mp4"
    assert artifact["artifactFileName"] == "视频讲解-audio-transcript.txt"
    assert artifact["contentType"] == "text/plain; charset=UTF-8"
    assert artifact["hasBinaryContent"] is False
    assert artifact["locator"] == "视频讲解/视频讲解.mp4#t=1-2"
