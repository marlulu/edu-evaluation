from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import WorkerSettings, get_settings
from app.modules.intelligent_evaluation.base.schemas import (
    EvaluationCapabilitiesResponse,
    EvaluationReviewRequest,
    EvaluationTaskRequest,
    EvaluationTaskResponse,
)
from app.modules.intelligent_evaluation.pipelines import (
    build_evaluation_capabilities_response,
    create_evaluation_task_response,
    create_review_record,
)
from app.providers import ProviderRegistry

router = APIRouter(prefix="/evaluate", tags=["intelligent-evaluation"])


def get_registry(settings: WorkerSettings = Depends(get_settings)) -> ProviderRegistry:
    return ProviderRegistry(settings)


@router.get("/capabilities", response_model=EvaluationCapabilitiesResponse)
def get_evaluation_capabilities(
    registry: ProviderRegistry = Depends(get_registry),
) -> EvaluationCapabilitiesResponse:
    return build_evaluation_capabilities_response(registry)


@router.post("/tasks", response_model=EvaluationTaskResponse)
def create_evaluation_task(
    request: EvaluationTaskRequest,
    registry: ProviderRegistry = Depends(get_registry),
) -> EvaluationTaskResponse:
    return create_evaluation_task_response(request, registry)


@router.post("/reviews")
def create_evaluation_review(
    request: EvaluationReviewRequest,
) -> dict[str, object]:
    review_record = create_review_record(request, original_total_score=0.0)
    return {
        "taskId": request.task_id,
        "status": "review_recorded_placeholder",
        "reviewRecord": review_record.model_dump(),
    }
