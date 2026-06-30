from __future__ import annotations

from collections.abc import Generator
from typing import Any

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
            api_key=self.settings.model_api_key or "",
            base_url=self.settings.model_api_base_url,
            timeout=self.settings.model_timeout_seconds,
        )

    def chat(
        self,
        message: str,
        *,
        model: str | None = None,
        system_prompt: str | None = None,
        stream: bool = False,
    ) -> str | Generator[dict[str, Any], None, None]:
        """发送对话请求，支持流式和非流式模式"""
        client = self.create_client()
        resolved_model = model or self.descriptor.model_name or "gpt-5.5"

        # 构建输入消息
        input_messages = []
        if system_prompt:
            input_messages.append({"role": "system", "content": system_prompt})
        input_messages.append({"role": "user", "content": message})

        if stream:
            return self._stream_response(client, resolved_model, input_messages)
        return self._sync_response(client, resolved_model, input_messages)

    def _sync_response(self, client: Any, model: str, input_messages: list[dict]) -> str:
        """同步模式：使用 responses API 流式获取完整结果"""
        with client.responses.stream(
            model=model,
            input=input_messages,
            store=False,
        ) as stream:
            result = ""
            for event in stream:
                if hasattr(event, "type") and event.type == "response.output_text.delta":
                    result += event.delta
        return result

    def _stream_response(
        self, client: Any, model: str, input_messages: list[dict]
    ) -> Generator[dict[str, Any], None, None]:
        """流式模式：逐块返回结果"""
        with client.responses.stream(
            model=model,
            input=input_messages,
            store=False,
        ) as stream:
            for event in stream:
                if hasattr(event, "type") and event.type == "response.output_text.delta":
                    yield {"type": "delta", "content": event.delta}
