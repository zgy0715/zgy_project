"""Health check API endpoints."""

import time

from fastapi import APIRouter

from app.config import get_settings
from app.models.schemas import HealthResponse

router = APIRouter()

_start_time: float = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Check the health status of the Agent Runtime service.

    Returns:
        HealthResponse with service status and dependency health.
    """
    settings = get_settings()
    uptime = time.time() - _start_time

    # Check LLM availability
    llm_status = "healthy"
    try:
        from app.services.llm_service import LLMService
        llm = LLMService()
        config = llm._config if hasattr(llm, '_config') else None
        if config and config.provider == "openai" and (
            not config.openai_api_key or config.openai_api_key == "sk-your-api-key-here"
        ):
            llm_status = "unconfigured"
    except Exception:
        llm_status = "unhealthy"

    services = {
        "redis": "healthy",
        "database": "healthy",
        "vector_engine": "healthy",
        "llm": llm_status,
    }

    overall_status = "healthy" if all(s == "healthy" for s in services.values()) else "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.app_version,
        uptime_seconds=round(uptime, 2),
        services=services,
    )


@router.get("/ready", response_model=dict[str, str])
async def readiness_check() -> dict[str, str]:
    """Check if the service is ready to accept requests.

    Returns:
        Readiness status.
    """
    # TODO: Verify all critical dependencies are reachable
    return {"status": "ready"}
