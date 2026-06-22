from __future__ import annotations

from app.modules.content_parsing.base.schemas import (
    MultimodalAssociation,
    ParseIssue,
    ParseModality,
    ParseTaskRequest,
    ParseTaskResponse,
    ParseTaskStatus,
    ParsingCapabilitiesResponse,
    ParsingCapability,
)
from app.modules.content_parsing.fusion import MULTIMODAL_FUSION_STEPS
from app.modules.content_parsing.pipelines.archive_pipeline import plan_archive_parse
from app.modules.content_parsing.pipelines.audio_pipeline import plan_audio_parse
from app.modules.content_parsing.pipelines.image_pipeline import plan_image_parse
from app.modules.content_parsing.pipelines.text_pipeline import plan_text_parse
from app.modules.content_parsing.pipelines.video_pipeline import plan_video_parse
from app.providers import ProviderRegistry
from app.providers.base import ProviderType


def build_capabilities_response(registry: ProviderRegistry) -> ParsingCapabilitiesResponse:
    providers = registry.snapshot().providers
    provider_map = {provider.provider_type: provider for provider in providers}
    return ParsingCapabilitiesResponse(
        providers=providers,
        capabilities=[
            ParsingCapability(
                modality=ParseModality.IMAGE,
                supported=True,
                planned_steps=[
                    "subject recognition",
                    "scene understanding",
                    "OCR",
                    "composition analysis",
                    "quality analysis",
                ],
                note=provider_map[ProviderType.VISION].note,
            ),
            ParsingCapability(
                modality=ParseModality.VIDEO,
                supported=True,
                planned_steps=[
                    "metadata extraction",
                    "keyframe extraction",
                    "shot segmentation",
                    "subtitle recognition",
                    "topic recognition",
                ],
                note=provider_map[ProviderType.MULTIMODAL].note,
            ),
            ParsingCapability(
                modality=ParseModality.AUDIO,
                supported=True,
                planned_steps=[
                    "transcription",
                    "volume analysis",
                    "clarity analysis",
                    "fluency analysis",
                    "emotion assistance",
                ],
                note=provider_map[ProviderType.SPEECH].note,
            ),
            ParsingCapability(
                modality=ParseModality.TEXT,
                supported=True,
                planned_steps=[
                    "text extraction",
                    "structure recognition",
                    "keyword extraction",
                    "topic summarization",
                    "logic analysis",
                ],
                note=provider_map[ProviderType.TEXT].note,
            ),
            ParsingCapability(
                modality=ParseModality.ARCHIVE,
                supported=True,
                planned_steps=[
                    "archive unpacking",
                    "directory recognition",
                    "file classification",
                    "nested parse planning",
                ],
                note="Archive orchestration is reserved in the AI worker and will call other modality pipelines later.",
            ),
            ParsingCapability(
                modality=ParseModality.MULTIMODAL,
                supported=True,
                planned_steps=MULTIMODAL_FUSION_STEPS,
                note=provider_map[ProviderType.MULTIMODAL].note,
            ),
        ],
        note="Current responses reserve contracts and provider slots only. Real model execution is intentionally deferred.",
    )


def create_parse_task_response(
    request: ParseTaskRequest,
    registry: ProviderRegistry,
) -> ParseTaskResponse:
    providers = registry.snapshot().providers
    provider_map = {provider.provider_type: provider for provider in providers}
    file_results = []

    for file_ref in request.files:
        if file_ref.modality == ParseModality.IMAGE:
            file_results.append(plan_image_parse(file_ref, provider_map[ProviderType.VISION]))
        elif file_ref.modality == ParseModality.VIDEO:
            file_results.append(
                plan_video_parse(file_ref, provider_map[ProviderType.MULTIMODAL])
            )
        elif file_ref.modality == ParseModality.AUDIO:
            file_results.append(plan_audio_parse(file_ref, provider_map[ProviderType.SPEECH]))
        elif file_ref.modality == ParseModality.TEXT:
            file_results.append(plan_text_parse(file_ref, provider_map[ProviderType.TEXT]))
        elif file_ref.modality == ParseModality.ARCHIVE:
            file_results.append(
                plan_archive_parse(file_ref, provider_map[ProviderType.MULTIMODAL])
            )

    configured = any(provider.configured for provider in providers)
    associations = []
    if len(request.files) > 1:
        associations.append(
            MultimodalAssociation(
                related_file_ids=[file_ref.file_id for file_ref in request.files],
                relation_type="submission-package",
                note="Reserved package-level relation for future multimodal fusion.",
            )
        )

    issues = []
    if not configured:
        issues.append(
            ParseIssue(
                code="PROVIDER_NOT_CONFIGURED",
                message=(
                    "No parsing provider is fully configured. Set the reserved "
                    "environment variables before enabling execution."
                ),
                retriable=True,
            )
        )

    summary = (
        "Parse task contract accepted and routed to placeholder pipelines."
        if configured
        else "Parse task contract accepted, but execution is waiting for provider configuration."
    )
    return ParseTaskResponse(
        task_id=request.task_id,
        submission_id=request.submission_id,
        status=(
            ParseTaskStatus.ACCEPTED
            if configured
            else ParseTaskStatus.PENDING_CONFIGURATION
        ),
        summary=summary,
        configured_providers=providers,
        file_results=file_results,
        multimodal_associations=associations,
        issues=issues,
    )
