from __future__ import annotations

from app.modules.content_parsing.base.schemas import (
    DerivedArtifact,
    FileParseResult,
    ParseTaskStatus,
    QualityMetric,
    SourceFileRef,
)
from app.providers.base import ProviderDescriptor


def build_stub_file_result(
    file_ref: SourceFileRef,
    provider: ProviderDescriptor,
    planned_steps: list[str],
    artifact_types: list[str],
) -> FileParseResult:
    provider_hint = ", ".join(provider.required_env_keys)
    return FileParseResult(
        file=file_ref,
        status=(
            ParseTaskStatus.ACCEPTED
            if provider.configured
            else ParseTaskStatus.PENDING_CONFIGURATION
        ),
        summary=(
            f"Reserved {file_ref.modality.value} parsing pipeline for {file_ref.file_name}. "
            f"Execution will start after the provider is configured."
        ),
        planned_steps=planned_steps,
        quality_metrics=[
            QualityMetric(
                name="provider_configuration",
                value="configured" if provider.configured else "missing",
                note=(
                    f"Expected environment keys: {provider_hint}."
                    if provider_hint
                    else "No provider environment keys declared."
                ),
            )
        ],
        derived_artifacts=[
            DerivedArtifact(
                artifact_type=artifact_type,
                uri=f"reserved://{file_ref.file_id}/{artifact_type}",
                note="Reserved artifact location for future parser output.",
            )
            for artifact_type in artifact_types
        ],
        warnings=[] if provider.configured else [f"Provider not ready: {provider.note}"],
    )
