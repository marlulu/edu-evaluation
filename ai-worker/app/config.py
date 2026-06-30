from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load .env file from project root
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


class WorkerSettings(BaseModel):
    service_name: str = "edu-evaluation-ai-worker"
    environment: str = "local"
    model_provider_driver: str = "openai-compatible"
    model_api_base_url: str | None = None
    model_api_key: str | None = None
    model_timeout_seconds: int = 60

    vision_provider_name: str | None = None
    vision_model_name: str | None = None
    speech_provider_name: str | None = None
    audio_model_name: str | None = None
    multimodal_provider_name: str | None = None
    multimodal_model_name: str | None = None
    text_provider_name: str | None = None
    text_model_name: str | None = None
    ocr_provider_name: str | None = None
    ocr_model_name: str | None = None
    asr_provider_name: str | None = None
    asr_model_name: str | None = None

    parse_task_callback_url: str | None = None
    parse_artifact_base_path: str = "data/parsing-artifacts"
    archive_extract_base_path: str = "data/archive-work"

    # MinIO 配置
    minio_endpoint: str | None = None
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_bucket: str = "coursework-submissions"
    minio_secure: bool = False

    @property
    def has_model_gateway(self) -> bool:
        return bool(self.model_api_base_url)

    @property
    def masked_api_key(self) -> str | None:
        if not self.model_api_key:
            return None
        if len(self.model_api_key) <= 6:
            return "*" * len(self.model_api_key)
        return f"{self.model_api_key[:3]}***{self.model_api_key[-2:]}"


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def reload_settings() -> None:
    """Clear the settings cache so next get_settings() reads fresh env vars."""
    get_settings.cache_clear()


@lru_cache(maxsize=1)
def get_settings() -> WorkerSettings:
    return WorkerSettings(
        service_name=_env("AI_WORKER_SERVICE_NAME", "edu-evaluation-ai-worker")
        or "edu-evaluation-ai-worker",
        environment=_env("AI_WORKER_ENV", "local") or "local",
        model_provider_driver=_env("MODEL_PROVIDER_DRIVER", "openai-compatible")
        or "openai-compatible",
        model_api_base_url=_env("MODEL_API_BASE_URL"),
        model_api_key=_env("MODEL_API_KEY"),
        model_timeout_seconds=int(_env("MODEL_TIMEOUT_SECONDS", "60") or "60"),
        vision_provider_name=_env("VISION_PROVIDER_NAME"),
        vision_model_name=_env("VISION_MODEL_NAME"),
        speech_provider_name=_env("SPEECH_PROVIDER_NAME"),
        audio_model_name=_env("AUDIO_MODEL_NAME"),
        multimodal_provider_name=_env("MULTIMODAL_PROVIDER_NAME"),
        multimodal_model_name=_env("MULTIMODAL_MODEL_NAME"),
        text_provider_name=_env("TEXT_PROVIDER_NAME"),
        text_model_name=_env("TEXT_MODEL_NAME"),
        ocr_provider_name=_env("OCR_PROVIDER_NAME"),
        ocr_model_name=_env("OCR_MODEL_NAME"),
        asr_provider_name=_env("ASR_PROVIDER_NAME"),
        asr_model_name=_env("ASR_MODEL_NAME"),
        parse_task_callback_url=_env("PARSE_TASK_CALLBACK_URL"),
        parse_artifact_base_path=_env(
            "PARSE_ARTIFACT_BASE_PATH",
            "data/parsing-artifacts",
        )
        or "data/parsing-artifacts",
        archive_extract_base_path=_env(
            "ARCHIVE_EXTRACT_BASE_PATH",
            "data/archive-work",
        )
        or "data/archive-work",
        minio_endpoint=_env("MINIO_ENDPOINT"),
        minio_access_key=_env("MINIO_ACCESS_KEY"),
        minio_secret_key=_env("MINIO_SECRET_KEY"),
        minio_bucket=_env("MINIO_BUCKET", "coursework-submissions") or "coursework-submissions",
        minio_secure=_env("MINIO_SECURE", "false").lower() == "true" if _env("MINIO_SECURE") else False,
    )


class PublicSettingsView(BaseModel):
    environment: str
    model_provider_driver: str
    model_api_base_url: str | None
    model_timeout_seconds: int
    parse_task_callback_url: str | None
    parse_artifact_base_path: str
    archive_extract_base_path: str
    configured_env_keys: list[str] = Field(default_factory=list)
    masked_api_key: str | None = None


def build_public_settings_view(settings: WorkerSettings) -> PublicSettingsView:
    configured_env_keys = [
        key
        for key, value in {
            "MODEL_API_BASE_URL": settings.model_api_base_url,
            "MODEL_PROVIDER_DRIVER": settings.model_provider_driver,
            "VISION_PROVIDER_NAME": settings.vision_provider_name,
            "VISION_MODEL_NAME": settings.vision_model_name,
            "SPEECH_PROVIDER_NAME": settings.speech_provider_name,
            "AUDIO_MODEL_NAME": settings.audio_model_name,
            "MULTIMODAL_PROVIDER_NAME": settings.multimodal_provider_name,
            "MULTIMODAL_MODEL_NAME": settings.multimodal_model_name,
            "TEXT_PROVIDER_NAME": settings.text_provider_name,
            "TEXT_MODEL_NAME": settings.text_model_name,
            "OCR_PROVIDER_NAME": settings.ocr_provider_name,
            "OCR_MODEL_NAME": settings.ocr_model_name,
            "ASR_PROVIDER_NAME": settings.asr_provider_name,
            "ASR_MODEL_NAME": settings.asr_model_name,
            "PARSE_TASK_CALLBACK_URL": settings.parse_task_callback_url,
        }.items()
        if value
    ]
    return PublicSettingsView(
        environment=settings.environment,
        model_provider_driver=settings.model_provider_driver,
        model_api_base_url=settings.model_api_base_url,
        model_timeout_seconds=settings.model_timeout_seconds,
        parse_task_callback_url=settings.parse_task_callback_url,
        parse_artifact_base_path=settings.parse_artifact_base_path,
        archive_extract_base_path=settings.archive_extract_base_path,
        configured_env_keys=configured_env_keys,
        masked_api_key=settings.masked_api_key,
    )
