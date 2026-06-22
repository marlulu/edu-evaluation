from __future__ import annotations

from pydantic import BaseModel

from app.config import WorkerSettings
from app.providers.base import ModelProvider, ProviderDescriptor


class OpenAIClientConfig(BaseModel):
    driver: str = "openai-compatible"
    base_url: str | None
    has_api_key: bool
    timeout_seconds: int


class OpenAICompatibleProvider(ModelProvider):
    def __init__(self, descriptor: ProviderDescriptor, settings: WorkerSettings) -> None:
        super().__init__(descriptor)
        self.settings = settings

    def client_config(self) -> OpenAIClientConfig:
        return OpenAIClientConfig(
            base_url=self.settings.model_api_base_url,
            has_api_key=bool(self.settings.model_api_key),
            timeout_seconds=self.settings.model_timeout_seconds,
        )

    def create_client(self):
        from openai import OpenAI

        return OpenAI(
            api_key=self.settings.model_api_key,
            base_url=self.settings.model_api_base_url,
            timeout=self.settings.model_timeout_seconds,
        )
