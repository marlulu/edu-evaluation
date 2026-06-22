from __future__ import annotations

from abc import ABC
from enum import Enum

from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    VISION = "vision"
    SPEECH = "speech"
    MULTIMODAL = "multimodal"
    TEXT = "text"
    OCR = "ocr"
    ASR = "asr"


class ProviderDescriptor(BaseModel):
    provider_type: ProviderType
    provider_name: str
    model_name: str | None = None
    base_url: str | None = None
    configured: bool = False
    required_env_keys: list[str] = Field(default_factory=list)
    configured_env_keys: list[str] = Field(default_factory=list)
    note: str


class ProviderHealth(BaseModel):
    provider_type: ProviderType
    configured: bool
    note: str


class ModelProvider(ABC):
    def __init__(self, descriptor: ProviderDescriptor) -> None:
        self.descriptor = descriptor

    def describe(self) -> ProviderDescriptor:
        return self.descriptor

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider_type=self.descriptor.provider_type,
            configured=self.descriptor.configured,
            note=self.descriptor.note,
        )
