from __future__ import annotations

from app.modules.content_parsing.base.schemas import FileParseResult, SourceFileRef
from app.modules.content_parsing.base.stub_factory import build_stub_file_result
from app.modules.content_parsing.image import IMAGE_PARSE_STEPS
from app.providers.base import ProviderDescriptor


def plan_image_parse(file_ref: SourceFileRef, provider: ProviderDescriptor) -> FileParseResult:
    return build_stub_file_result(
        file_ref,
        provider,
        IMAGE_PARSE_STEPS,
        ["image-features.json", "ocr.json", "quality.json"],
    )
