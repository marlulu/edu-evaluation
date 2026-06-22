from __future__ import annotations

from app.modules.intelligent_evaluation.base.schemas import (
    EvaluationReviewRequest,
    ReviewRecord,
)


def create_review_record(
    request: EvaluationReviewRequest,
    original_total_score: float,
) -> ReviewRecord:
    return ReviewRecord(
        reviewer_id=request.reviewer_id,
        reviewer_name=request.reviewer_name,
        original_total_score=original_total_score,
        revised_total_score=request.revised_total_score,
        reason=request.reason,
    )
