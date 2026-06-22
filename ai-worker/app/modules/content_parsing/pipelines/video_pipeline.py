from __future__ import annotations

from app.modules.content_parsing.base.schemas import FileParseResult, SourceFileRef
from app.modules.content_parsing.base.stub_factory import build_stub_file_result
from app.modules.content_parsing.video import VIDEO_PARSE_STEPS
from app.providers.base import ProviderDescriptor


def plan_video_parse(file_ref: SourceFileRef, provider: ProviderDescriptor) -> FileParseResult:
    return build_stub_file_result(
        file_ref,
        provider,
        VIDEO_PARSE_STEPS,
        ["video-metadata.json", "keyframes.json", "subtitles.json"],
    )
