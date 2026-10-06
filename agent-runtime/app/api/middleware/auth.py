"""Authentication middleware for Agent Runtime API.

Validates an internal API key shared with the API Gateway to ensure
only the gateway can directly call the agent runtime APIs.
"""

import hmac
import logging
import posixpath
from urllib.parse import unquote

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import get_settings

logger = logging.getLogger(__name__)

# Paths that don't require authentication
PUBLIC_PATHS = [
    "/api/v1/health",
    "/api/v1/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
]

# Header used by the API Gateway to forward the shared secret (lower-case, as
# ASGI exposes header names in their raw form).
INTERNAL_KEY_HEADER = b"x-deepagent-internal-key"

# Alias accepted in addition to the gateway header, so other clients (and test
# suites) can use the shorter name without weakening the check.
INTERNAL_KEY_HEADER_ALIASES = (INTERNAL_KEY_HEADER, b"x-internal-api-key")

# Upper bound on the number of percent-decoding passes applied while
# normalizing a request path.
_MAX_DECODE_PASSES = 3


def normalize_path(raw_path: str) -> str:
    """Return a canonical form of ``raw_path`` for prefix comparisons.

    Percent-decoding is applied repeatedly and ``.``/``..`` segments are
    collapsed, so a request such as ``/api/v1/health%2f..%2f..%2fagents`` can
    no longer match an exempt prefix before the router itself normalizes the
    path.
    """
    decoded = raw_path
    for _ in range(_MAX_DECODE_PASSES):
        once = unquote(decoded)
        if once == decoded:
            break
        decoded = once

    normalized = posixpath.normpath(decoded.replace("\\", "/"))
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized


def is_public_path(raw_path: str) -> bool:
    """Return True when ``raw_path`` is exempt from internal authentication."""
    path = normalize_path(raw_path)
    for public in PUBLIC_PATHS:
        if path == public or path.startswith(f"{public}/"):
            return True
    return False


def _get_header(scope: Scope, name: bytes) -> str:
    """Return the value of header ``name`` from an ASGI scope, or ""."""
    for key, value in scope.get("headers", []):
        if key.lower() == name:
            return value.decode("latin-1")
    return ""


class InternalAuthMiddleware:
    """Require the internal API key on every non-public request.

    Implemented as a pure ASGI middleware rather than
    ``BaseHTTPMiddleware`` so that WebSocket handshakes are authenticated too
    (``BaseHTTPMiddleware`` only ever observes ``http`` scopes).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if is_public_path(path):
            await self.app(scope, receive, send)
            return

        settings = get_settings()
        expected_key = settings.security.internal_api_key

        # Fail closed: a missing key is a deployment error, not a licence to
        # serve unauthenticated traffic.
        if not expected_key:
            if settings.security.allow_insecure_no_auth:
                logger.warning(
                    "SECURITY_INTERNAL_API_KEY not set and "
                    "SECURITY_ALLOW_INSECURE_NO_AUTH is enabled — agent runtime "
                    "API is unprotected. Never use this in production."
                )
                await self.app(scope, receive, send)
                return

            logger.error(
                "SECURITY_INTERNAL_API_KEY is not set — rejecting %s %s. "
                "Set this to the same value as the API Gateway.",
                scope["type"],
                path,
            )
            await self._reject(
                scope,
                receive,
                send,
                status_code=503,
                detail="Service misconfigured: internal API key is not set",
            )
            return

        provided_key = ""
        for header_name in INTERNAL_KEY_HEADER_ALIASES:
            provided_key = _get_header(scope, header_name)
            if provided_key:
                break
        # Constant-time comparison to avoid leaking the key through timing.
        if not hmac.compare_digest(provided_key, expected_key):
            logger.warning(
                "Rejected request to %s from %s with invalid internal API key",
                path,
                scope.get("client")[0] if scope.get("client") else "unknown",
            )
            await self._reject(
                scope,
                receive,
                send,
                status_code=403,
                detail="Forbidden: invalid internal API key",
            )
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _reject(
        scope: Scope,
        receive: Receive,
        send: Send,
        status_code: int,
        detail: str,
    ) -> None:
        """Reject a request/websocket without leaking internals."""
        if scope["type"] == "websocket":
            # Closing before `accept` makes the server answer the handshake
            # with an HTTP error, which is the correct rejection for a
            # WebSocket client.
            await send({"type": "websocket.close", "code": 1008})
            return

        response = JSONResponse({"detail": detail}, status_code=status_code)
        await response(scope, receive, send)
