from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import WorkerSettings, get_settings
from app.modules.content_parsing.base.schemas import (
    ParseTaskRequest,
    ParseTaskResponse,
    ParsingCapabilitiesResponse,
)
from app.modules.content_parsing.pipelines import (
    build_capabilities_response,
    create_parse_task_response,
)
from app.providers import ProviderRegistry

router = APIRouter(prefix="/parse", tags=["content-parsing"])


def get_registry(settings: WorkerSettings = Depends(get_settings)) -> ProviderRegistry:
    return ProviderRegistry(settings)


@router.get("/capabilities", response_model=ParsingCapabilitiesResponse)
def get_parsing_capabilities(
    registry: ProviderRegistry = Depends(get_registry),
) -> ParsingCapabilitiesResponse:
    return build_capabilities_response(registry)


@router.get("/providers")
def get_provider_registry(
    registry: ProviderRegistry = Depends(get_registry),
) -> dict[str, object]:
    snapshot = registry.snapshot()
    return {
        "configuredProviderCount": snapshot.configured_provider_count,
        "providers": [provider.model_dump() for provider in snapshot.providers],
    }


@router.post("/tasks", response_model=ParseTaskResponse)
def create_parse_task(
    request: ParseTaskRequest,
    registry: ProviderRegistry = Depends(get_registry),
) -> ParseTaskResponse:
    return create_parse_task_response(request, registry)
