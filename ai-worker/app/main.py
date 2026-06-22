from datetime import datetime, timezone

from fastapi import FastAPI

from app.config import build_public_settings_view, get_settings
from app.modules.content_parsing import router as content_parsing_router
from app.modules.intelligent_evaluation import router as intelligent_evaluation_router

app = FastAPI(
    title="AI Coursework Evaluation Worker",
    version="0.2.0",
    description="Framework shell for future extraction and AI evaluation jobs.",
)
app.include_router(content_parsing_router)
app.include_router(intelligent_evaluation_router)


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
