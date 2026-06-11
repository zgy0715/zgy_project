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

    # TODO: Check actual health of dependencies
    services = {
        "redis": "healthy",
        "database": "healthy",
        "vector_engine": "healthy",
        "llm": "healthy",
    }

    return HealthResponse(
        status="healthy",
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
