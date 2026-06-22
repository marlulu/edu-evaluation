from __future__ import annotations

from pydantic import BaseModel, Field

from app.config import WorkerSettings
from app.providers.base import ModelProvider, ProviderDescriptor, ProviderType
from app.providers.openai_compatible import OpenAICompatibleProvider


class PlaceholderProvider(ModelProvider):
    pass


class ProviderRegistrySnapshot(BaseModel):
    providers: list[ProviderDescriptor] = Field(default_factory=list)

    @property
    def configured_provider_count(self) -> int:
        return sum(1 for provider in self.providers if provider.configured)


class ProviderRegistry:
    def __init__(self, settings: WorkerSettings) -> None:
        self.settings = settings
        self.providers = {
            descriptor.provider_type: self._build_provider(descriptor)
            for descriptor in self._build_descriptors()
        }

    def _build_provider(self, descriptor: ProviderDescriptor) -> ModelProvider:
        if self.settings.model_provider_driver == "openai-compatible":
            return OpenAICompatibleProvider(descriptor, self.settings)
        return PlaceholderProvider(descriptor)

    def _build_descriptors(self) -> list[ProviderDescriptor]:
        return [
            self._descriptor(
                provider_type=ProviderType.VISION,
                provider_name=self.settings.vision_provider_name,
                model_name=self.settings.vision_model_name,
                required_env_keys=[
                    "MODEL_API_BASE_URL",
                    "VISION_PROVIDER_NAME",
                    "VISION_MODEL_NAME",
                ],
                note="Reserved for image understanding, detection, OCR routing, and quality analysis.",
            ),
            self._descriptor(
                provider_type=ProviderType.SPEECH,
                provider_name=self.settings.speech_provider_name,
                model_name=self.settings.audio_model_name,
                required_env_keys=[
                    "MODEL_API_BASE_URL",
                    "SPEECH_PROVIDER_NAME",
                    "AUDIO_MODEL_NAME",
                ],
                note="Reserved for audio transcription, fluency, clarity, and rhythm analysis.",
            ),
            self._descriptor(
                provider_type=ProviderType.MULTIMODAL,
                provider_name=self.settings.multimodal_provider_name,
                model_name=self.settings.multimodal_model_name,
                required_env_keys=[
                    "MODEL_API_BASE_URL",
                    "MULTIMODAL_PROVIDER_NAME",
                    "MULTIMODAL_MODEL_NAME",
                ],
                note="Reserved for cross-file and cross-modality correlation.",
            ),
            self._descriptor(
                provider_type=ProviderType.TEXT,
                provider_name=self.settings.text_provider_name,
                model_name=self.settings.text_model_name,
                required_env_keys=[
                    "MODEL_API_BASE_URL",
                    "TEXT_PROVIDER_NAME",
                    "TEXT_MODEL_NAME",
                ],
                note="Reserved for supplementary document parsing and summarization.",
            ),
            self._descriptor(
                provider_type=ProviderType.OCR,
                provider_name=self.settings.ocr_provider_name,
                model_name=self.settings.ocr_model_name,
                required_env_keys=["OCR_PROVIDER_NAME", "OCR_MODEL_NAME"],
                note="Reserved for dedicated OCR engines when OCR is not routed through the vision model.",
            ),
            self._descriptor(
                provider_type=ProviderType.ASR,
                provider_name=self.settings.asr_provider_name,
                model_name=self.settings.asr_model_name,
                required_env_keys=["ASR_PROVIDER_NAME", "ASR_MODEL_NAME"],
                note="Reserved for dedicated ASR engines when ASR is not routed through the speech model.",
            ),
        ]

    def _descriptor(
        self,
        *,
        provider_type: ProviderType,
        provider_name: str | None,
        model_name: str | None,
        required_env_keys: list[str],
        note: str,
    ) -> ProviderDescriptor:
        present_keys = []
        key_values = {
            "MODEL_API_BASE_URL": self.settings.model_api_base_url,
            "VISION_PROVIDER_NAME": self.settings.vision_provider_name,
            "VISION_MODEL_NAME": self.settings.vision_model_name,
            "SPEECH_PROVIDER_NAME": self.settings.speech_provider_name,
            "AUDIO_MODEL_NAME": self.settings.audio_model_name,
            "MULTIMODAL_PROVIDER_NAME": self.settings.multimodal_provider_name,
            "MULTIMODAL_MODEL_NAME": self.settings.multimodal_model_name,
            "TEXT_PROVIDER_NAME": self.settings.text_provider_name,
            "TEXT_MODEL_NAME": self.settings.text_model_name,
            "OCR_PROVIDER_NAME": self.settings.ocr_provider_name,
            "OCR_MODEL_NAME": self.settings.ocr_model_name,
            "ASR_PROVIDER_NAME": self.settings.asr_provider_name,
            "ASR_MODEL_NAME": self.settings.asr_model_name,
        }
        for key in required_env_keys:
            if key_values.get(key):
                present_keys.append(key)
        configured = len(present_keys) == len(required_env_keys)
        resolved_provider_name = provider_name or f"{provider_type.value}-provider-placeholder"
        return ProviderDescriptor(
            provider_type=provider_type,
            provider_name=resolved_provider_name,
            model_name=model_name,
            base_url=self.settings.model_api_base_url,
            configured=configured,
            required_env_keys=required_env_keys,
            configured_env_keys=present_keys,
            note=note,
        )

    def snapshot(self) -> ProviderRegistrySnapshot:
        return ProviderRegistrySnapshot(
            providers=[provider.describe() for provider in self.providers.values()]
        )

    def get(self, provider_type: ProviderType) -> ModelProvider:
        return self.providers[provider_type]
