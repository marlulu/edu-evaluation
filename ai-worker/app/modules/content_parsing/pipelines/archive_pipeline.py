from __future__ import annotations

from app.modules.content_parsing.archive import ARCHIVE_PARSE_STEPS
from app.modules.content_parsing.base.schemas import FileParseResult, SourceFileRef
from app.modules.content_parsing.base.stub_factory import build_stub_file_result
from app.providers.base import ProviderDescriptor


def plan_archive_parse(
    file_ref: SourceFileRef,
    provider: ProviderDescriptor,
) -> FileParseResult:
    return build_stub_file_result(
        file_ref,
        provider,
        ARCHIVE_PARSE_STEPS,
        ["archive-manifest.json", "classified-files.json"],
    )
