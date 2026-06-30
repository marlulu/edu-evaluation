from datetime import datetime, timezone

from fastapi import FastAPI

from app.config import build_public_settings_view, get_settings, reload_settings
from app.modules.video_analysis import router as video_analysis_router

app = FastAPI(
    title="AI Coursework Evaluation Worker",
    version="0.5.0",
    description="Framework shell for future extraction and AI evaluation jobs.",
)
app.include_router(video_analysis_router)


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
