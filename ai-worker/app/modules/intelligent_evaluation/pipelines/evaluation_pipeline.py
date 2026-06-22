from __future__ import annotations

from app.modules.intelligent_evaluation.base.schemas import (
    DimensionScore,
    EvaluationCapability,
    EvaluationCapabilitiesResponse,
    EvaluationIssue,
    EvaluationTaskRequest,
    EvaluationTaskResponse,
    EvaluationTaskStatus,
    RevisionSuggestion,
    ScoreEvidence,
)
from app.modules.intelligent_evaluation.feedback import EVALUATION_FEEDBACK_STEPS
from app.modules.intelligent_evaluation.issues import EVALUATION_ISSUE_STEPS
from app.modules.intelligent_evaluation.review import EVALUATION_REVIEW_STEPS
from app.modules.intelligent_evaluation.scoring import EVALUATION_SCORING_STEPS
from app.providers import ProviderRegistry
from app.providers.base import ProviderType


def build_evaluation_capabilities_response(
    registry: ProviderRegistry,
) -> EvaluationCapabilitiesResponse:
    providers = registry.snapshot().providers
    return EvaluationCapabilitiesResponse(
        providers=providers,
        capabilities=[
            EvaluationCapability(
                capability="rubric_scoring",
                supported=True,
                note="Reserved automatic scoring against rubric dimensions, weights, and rule text.",
            ),
            EvaluationCapability(
                capability="score_explanation",
                supported=True,
                note="Reserved dimension-level explanations and evidence mapping.",
            ),
            EvaluationCapability(
                capability="issue_detection",
                supported=True,
                note="Reserved issue categorization and trace localization.",
            ),
            EvaluationCapability(
                capability="suggestion_generation",
                supported=True,
                note="Reserved differentiated revision suggestion generation.",
            ),
            EvaluationCapability(
                capability="manual_review_trace",
                supported=True,
                note="Reserved review correction trail for teachers and assistants.",
            ),
        ],
        note="Current responses reserve evaluation contracts and provider slots only. Real model execution is intentionally deferred.",
    )


def create_evaluation_task_response(
    request: EvaluationTaskRequest,
    registry: ProviderRegistry,
) -> EvaluationTaskResponse:
    providers = registry.snapshot().providers
    multimodal_provider = next(
        provider for provider in providers if provider.provider_type == ProviderType.MULTIMODAL
    )
    text_provider = next(
        provider for provider in providers if provider.provider_type == ProviderType.TEXT
    )
    configured = multimodal_provider.configured or text_provider.configured

    dimension_scores = []
    total_score = 0.0
    for dimension in request.rubric.dimensions:
        midpoint = round(
            (dimension.score_range.min_score + dimension.score_range.max_score) / 2,
            2,
        )
        weighted_score = round(midpoint * dimension.weight, 2)
        total_score += weighted_score
        evidence = []
        if request.parsed_evidence:
            evidence.append(
                ScoreEvidence(
                    source_file_id=request.parsed_evidence[0].source_file_id,
                    evidence_unit_id=request.parsed_evidence[0].evidence_unit_id,
                    reason="Reserved evidence mapping placeholder for future dimension scoring.",
                    trace=request.parsed_evidence[0].trace,
                )
            )
        dimension_scores.append(
            DimensionScore(
                dimension_id=dimension.dimension_id,
                dimension_name=dimension.name,
                score=midpoint,
                weight=dimension.weight,
                weighted_score=weighted_score,
                basis=(
                    "Placeholder midpoint score generated from rubric range until model-backed scoring is enabled."
                ),
                evidence=evidence,
            )
        )

    issues = [
        EvaluationIssue(
            category="placeholder",
            severity="info",
            title="Scoring pipeline not enabled",
            description="Issue detection is reserved and will run after model providers are configured.",
        )
    ]
    suggestions = [
        RevisionSuggestion(
            score_band="placeholder",
            title="Enable provider configuration",
            details="Connect your model endpoint and selected evaluation models before using automatic scoring results for teaching decisions.",
        )
    ]
    score_band = "pending_configuration" if not configured else "prototype"

    warnings = []
    warnings.extend(EVALUATION_SCORING_STEPS)
    warnings.extend(EVALUATION_ISSUE_STEPS)
    warnings.extend(EVALUATION_FEEDBACK_STEPS)
    warnings.extend(EVALUATION_REVIEW_STEPS)

    return EvaluationTaskResponse(
        task_id=request.task_id,
        submission_id=request.submission_id,
        status=(
            EvaluationTaskStatus.ACCEPTED
            if configured
            else EvaluationTaskStatus.PENDING_CONFIGURATION
        ),
        rubric_snapshot=request.rubric,
        total_score=round(total_score, 2),
        score_band=score_band,
        summary=(
            "Evaluation task contract accepted and routed to placeholder scoring pipelines."
            if configured
            else "Evaluation task contract accepted, but execution is waiting for provider configuration."
        ),
        dimension_scores=dimension_scores,
        issues=issues,
        suggestions=suggestions,
        configured_providers=providers,
        warnings=warnings,
    )
