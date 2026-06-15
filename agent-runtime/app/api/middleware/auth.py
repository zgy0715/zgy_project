"""Authentication middleware for Agent Runtime API.

Validates an internal API key shared with the API Gateway to ensure
only the gateway can directly call the agent runtime APIs.
"""

import logging
from typing import Any

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.config import get_settings

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = [
    "/api/v1/health",
    "/docs",
    "/redoc",
    "/openapi.json",
]


class InternalAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that requires an internal API key for all non-public endpoints.

    The API Gateway sets this key in the ``X-DeepAgent-Internal-Key`` header
    when proxying requests to the Agent Runtime. This prevents direct access
    to the Agent Runtime from untrusted sources.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Skip auth for public paths
        if any(request.url.path.startswith(path) for path in PUBLIC_PATHS):
            return await call_next(request)

        settings = get_settings()
        expected_key = settings.security.internal_api_key

        # If no key is configured, allow all requests (backward compatibility)
        if not expected_key:
            logger.warning(
                "SECURITY_INTERNAL_API_KEY not set — agent runtime API is unprotected. "
                "Set this to the same value as the API Gateway."
            )
            return await call_next(request)

        # Validate the API key
        provided_key = request.headers.get("X-DeepAgent-Internal-Key", "")
        if provided_key != expected_key:
            logger.warning(
                "Rejected request to %s from %s with invalid internal API key",
                request.url.path,
                request.client.host if request.client else "unknown",
            )
            raise HTTPException(status_code=403, detail="Forbidden: invalid internal API key")

        return await call_next(request)
