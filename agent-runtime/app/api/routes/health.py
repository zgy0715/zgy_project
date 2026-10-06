"""Health check API endpoints."""

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, Request, Response

from app.config import get_settings
from app.models.schemas import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()

_start_time: float = time.time()

# Upper bound for a single dependency probe.
_PROBE_TIMEOUT = 3.0

# Values that mean "this dependency is configured but broken".
_FAILED_STATUSES = {"unhealthy", "unreachable"}


def _llm_status() -> str:
    """Report whether the configured LLM provider has usable credentials."""
    settings = get_settings()
    if settings.llm.provider == "openai":
        api_key = settings.llm.openai_api_key.strip()
        if not api_key or api_key == "sk-your-api-key-here":
            return "unconfigured"
    return "configured"


async def _probe_redis(request: Request) -> str:
    """Ping Redis, or report that it was never configured."""
    client: Any = getattr(request.app.state, "redis", None)
    if client is None:
        return "not_configured"
    try:
        await asyncio.wait_for(client.ping(), timeout=_PROBE_TIMEOUT)
        return "healthy"
    except Exception as exc:
        logger.warning("Redis health probe failed: %s", exc)
        return "unhealthy"


async def _probe_database(request: Request) -> str:
    """Run a trivial query against the database, or report it as not configured."""
    engine: Any = getattr(request.app.state, "db_engine", None)
    if engine is None:
        return "not_configured"

    async def _ping() -> None:
        from sqlalchemy import text

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(_ping(), timeout=_PROBE_TIMEOUT)
        return "healthy"
    except Exception as exc:
        logger.warning("Database health probe failed: %s", exc)
        return "unhealthy"


async def _probe_vector_engine(request: Request) -> str:
    """Probe the vector engine, or report that it was never configured."""
    service: Any = getattr(request.app.state, "vector_service", None)
    if service is None:
        return "not_configured"
    probe = getattr(service, "health", None)
    if not callable(probe):
        return "configured"
    try:
        status = await asyncio.wait_for(probe(), timeout=_PROBE_TIMEOUT + 2.0)
        return str(status)
    except Exception as exc:
        logger.warning("Vector engine health probe failed: %s", exc)
        return "unreachable"


async def _collect_services(request: Request) -> dict[str, str]:
    """Probe every dependency concurrently and return their real statuses."""
    redis_status, db_status, vector_status = await asyncio.gather(
        _probe_redis(request),
        _probe_database(request),
        _probe_vector_engine(request),
    )
    return {
        "redis": redis_status,
        "database": db_status,
        "vector_engine": vector_status,
        "llm": _llm_status(),
    }


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Check the health status of the Agent Runtime service.

    Every dependency is probed (or explicitly reported as "not_configured" /
    "unconfigured"); nothing is assumed to be healthy. The overall status is
    "degraded" as soon as a configured dependency is failing, while an
    unconfigured optional dependency keeps the service "healthy".

    Returns:
        HealthResponse with service status and dependency health.
    """
    settings = get_settings()
    uptime = time.time() - _start_time

    services = await _collect_services(request)
    overall_status = (
        "degraded" if any(s in _FAILED_STATUSES for s in services.values()) else "healthy"
    )

    return HealthResponse(
        status=overall_status,
        version=settings.app_version,
        uptime_seconds=round(uptime, 2),
        services=services,
    )


@router.get("/ready", response_model=dict[str, str])
async def readiness_check(request: Request, response: Response) -> dict[str, str]:
    """Check if the service is ready to accept requests.

    Readiness requires the persistence/cache layers (Redis, database) to be
    reachable whenever they are configured; an unreachable vector engine only
    degrades semantic search, so it does not block readiness.

    Returns:
        Readiness status; HTTP 503 when a critical dependency is failing.
    """
    services = await _collect_services(request)

    critical = {
        "redis": services["redis"],
        "database": services["database"],
    }
    failing = [name for name, status in critical.items() if status in _FAILED_STATUSES]
    if failing:
        logger.error("Readiness check failed: %s", ", ".join(failing))
        response.status_code = 503
        return {"status": "not_ready"}

    return {"status": "ready"}
