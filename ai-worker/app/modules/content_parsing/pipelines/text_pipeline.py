from __future__ import annotations

from app.modules.content_parsing.base.schemas import FileParseResult, SourceFileRef
from app.modules.content_parsing.base.stub_factory import build_stub_file_result
from app.modules.content_parsing.text import TEXT_PARSE_STEPS
from app.providers.base import ProviderDescriptor


def plan_text_parse(file_ref: SourceFileRef, provider: ProviderDescriptor) -> FileParseResult:
    return build_stub_file_result(
        file_ref,
        provider,
        TEXT_PARSE_STEPS,
        ["text-structure.json", "keywords.json", "logic.json"],
    )
