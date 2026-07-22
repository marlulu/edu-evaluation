from datetime import datetime, timezone
import time

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.config import build_public_settings_view, get_settings, reload_settings
from app.modules.document_validation.router import router as document_validation_router
from app.submission_manifest import SubmissionManifest, SubmissionManifestRequest, build_manifest, download_object_keys
from app.content_analysis import ContentExtractionResult, extract_content
from app.analysis_jobs import AnalysisJob, analysis_jobs
from app.rule_interpreter import InterpretedRules, interpret_rules

app = FastAPI(
    title="AI Coursework Evaluation Worker",
    version="0.5.0",
    description="Framework shell for future extraction and AI evaluation jobs.",
)
app.include_router(document_validation_router)


@app.on_event("startup")
async def resume_analysis_jobs() -> None:
    await analysis_jobs.resume_pending()


@app.post("/submission-manifest", response_model=SubmissionManifest)
def submission_manifest(request: SubmissionManifestRequest) -> SubmissionManifest:
    if request.object_keys:
        directory, paths = download_object_keys(request.object_keys)
        try:
            return build_manifest(paths)
        finally:
            directory.cleanup()
    return build_manifest(request.file_paths)


@app.post("/content-extraction", response_model=ContentExtractionResult)
def content_extraction(request: SubmissionManifestRequest) -> ContentExtractionResult:
    if request.object_keys:
        directory, paths = download_object_keys(request.object_keys)
        try:
            return extract_content(paths)
        finally:
            directory.cleanup()
    return extract_content(request.file_paths)


@app.post("/analysis/jobs", response_model=AnalysisJob)
async def submit_analysis_job(request: SubmissionManifestRequest) -> AnalysisJob:
    return await analysis_jobs.submit(request.object_keys, request.file_paths, request.rule_text)


@app.get("/analysis/jobs/{job_id}", response_model=AnalysisJob)
def get_analysis_job(job_id: str) -> AnalysisJob:
    job = analysis_jobs.get(job_id)
    if job is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.delete("/analysis/jobs/{job_id}", response_model=AnalysisJob)
def cancel_analysis_job(job_id: str) -> AnalysisJob:
    job = analysis_jobs.cancel(job_id)
    if job is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


@app.post("/rules/interpret", response_model=InterpretedRules)
def rules_interpret(request: dict[str, str]) -> InterpretedRules:
    return interpret_rules(request.get("ruleText") or request.get("rule_text") or "")


@app.post("/analysis/manifest", response_model=SubmissionManifest)
def analysis_manifest(request: dict[str, object]) -> SubmissionManifest:
    paths: list[str] = []
    file_path = request.get("filePath") or request.get("file_path")
    if isinstance(file_path, str) and file_path:
        paths.append(file_path)
    image_paths = request.get("imagePaths") or request.get("image_paths") or []
    if isinstance(image_paths, list):
        paths.extend(path for path in image_paths if isinstance(path, str) and path)
    return build_manifest(paths)


class ModelTestRequest(BaseModel):
    base_url: str
    api_key: str
    model_name: str


@app.post("/model-test")
def test_model(request: ModelTestRequest) -> dict[str, object]:
    """Run a minimal OpenAI Responses SDK request for an administrator profile."""
    from openai import OpenAI

    started = time.monotonic()
    try:
        client = OpenAI(api_key=request.api_key, base_url=request.base_url)
        stream = client.responses.create(
            model=request.model_name,
            input=[{"role": "user", "content": "你好"}],
            stream=True,
            store=True,
        )
        chunks: list[str] = []
        for event in stream:
            if event.type == "response.output_text.delta":
                chunks.append(event.delta)
        output = "".join(chunks)
        return {
            "success": bool(output.strip()),
            "message": output or "The provider returned no text response.",
            "latencyMs": max(1, round((time.monotonic() - started) * 1000)),
            "requestedModel": request.model_name,
            "requestedBaseUrl": request.base_url,
        }
    except Exception as exception:
        message = str(exception).replace(request.api_key, "***")
        return {
            "success": False,
            "message": message[:300] or "Connection test failed.",
            "latencyMs": max(1, round((time.monotonic() - started) * 1000)),
            "requestedModel": request.model_name,
            "requestedBaseUrl": request.base_url,
        }


@app.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "service": settings.service_name,
        "status": "ok",
        "time": datetime.now(timezone.utc).isoformat(),
        "modelGatewayConfigured": settings.has_model_gateway,
        "configuredSettings": build_public_settings_view(settings).model_dump(),
    }


@app.post("/reload-config")
def reload_config() -> dict[str, object]:
    reload_settings()
    settings = get_settings()
    return {
        "status": "reloaded",
        "modelGatewayConfigured": settings.has_model_gateway,
        "configuredSettings": build_public_settings_view(settings).model_dump(),
    }
