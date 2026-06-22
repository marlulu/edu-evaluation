from __future__ import annotations

from app.modules.content_parsing.audio import AUDIO_PARSE_STEPS
from app.modules.content_parsing.base.schemas import FileParseResult, SourceFileRef
from app.modules.content_parsing.base.stub_factory import build_stub_file_result
from app.providers.base import ProviderDescriptor


def plan_audio_parse(file_ref: SourceFileRef, provider: ProviderDescriptor) -> FileParseResult:
    return build_stub_file_result(
        file_ref,
        provider,
        AUDIO_PARSE_STEPS,
        ["transcript.json", "audio-quality.json", "fluency.json"],
    )
