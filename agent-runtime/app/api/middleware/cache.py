"""Response caching middleware for the Agent Runtime API.

Provides in-memory caching for GET requests to reduce backend load
and improve response times for frequently accessed resources.
"""

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class LRUCache:
    """Least Recently Used cache with TTL support."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 60):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[tuple[Any, bool]]:
        """Get value from cache. Returns (value, is_hit) tuple."""
        if key in self._cache:
            value, expires_at = self._cache[key]
            if time.time() < expires_at:
                self._cache.move_to_end(key)
                self._hits += 1
                return value, True
            # Expired — remove it
            del self._cache[key]
        self._misses += 1
        return None, False

    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Put value in cache with optional TTL."""
        if key in self._cache:
            del self._cache[key]
        elif len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)  # Remove LRU item
        self._cache[key] = (value, time.time() + (ttl or self._default_ttl))

    def invalidate(self, prefix: str = "") -> int:
        """Invalidate cache entries matching a prefix. Returns count removed."""
        if not prefix:
            count = len(self._cache)
            self._cache.clear()
            return count
        keys_to_remove = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_remove:
            del self._cache[k]
        return len(keys_to_remove)

    @property
    def size(self) -> int:
        """Current number of entries in the cache."""
        return len(self._cache)

    @property
    def hit_rate(self) -> float:
        """Cache hit rate as a fraction (0.0 to 1.0)."""
        total = self._hits + self._misses
        return self._hits / total if total > 0 else 0.0

    @property
    def stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        return {
            "size": self.size,
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self.hit_rate, 4),
        }


class CacheMiddleware(BaseHTTPMiddleware):
    """HTTP response caching middleware.

    Caches GET responses with configurable TTL per route pattern.
    Supports cache invalidation via prefix matching and provides
    cache statistics for monitoring.
    """

    # Route-specific TTL configuration (seconds)
    ROUTE_TTL: dict[str, int] = {
        "/api/v1/agents": 30,          # Agent list: 30s
        "/api/v1/workflows": 30,       # Workflow list: 30s
        "/health": 10,                  # Health check: 10s
        "/ready": 10,                   # Readiness check: 10s
        "/api/v1/agents/": 60,         # Agent detail: 60s
        "/api/v1/workflows/": 60,      # Workflow detail: 60s
        "/api/v1/agents/": 60,         # Agent messages/thinking-chain: 60s
    }

    # Routes that should NOT be cached (write/mutation paths)
    NO_CACHE_PATHS: set[str] = {
        "/chat",
        "/execute",
        "/stream",
        "/index",
    }

    def __init__(self, app, max_size: int = 1000, default_ttl: int = 60):
        super().__init__(app)
        self._cache = LRUCache(max_size=max_size, default_ttl=default_ttl)

    async def dispatch(self, request: Request, call_next):
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)

        path = request.url.path

        # Skip caching for mutation-adjacent paths
        if self._should_skip(path):
            return await call_next(request)

        # Generate cache key
        cache_key = self._make_key(request)

        # Try cache
        cached, hit = self._cache.get(cache_key)
        if hit and cached is not None:
            response = Response(
                content=cached["body"],
                status_code=cached["status"],
                headers=dict(cached["headers"]),
                media_type=cached.get("media_type"),
            )
            response.headers["X-Cache"] = "HIT"
            return response

        # Call next middleware/handler
        response = await call_next(request)

        # Only cache successful responses
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk

            ttl = self._get_ttl(path)
            self._cache.put(
                cache_key,
                {
                    "body": body.decode("utf-8", errors="replace"),
                    "status": response.status_code,
                    "headers": {
                        k: v for k, v in response.headers.items()
                        if k.lower() not in ("transfer-encoding", "content-length")
                    },
                    "media_type": response.media_type,
                },
                ttl=ttl,
            )

            # Return the response from the collected body
            cached_response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
            cached_response.headers["X-Cache"] = "MISS"
            return cached_response

        return response

    def _make_key(self, request: Request) -> str:
        """Generate a cache key from the request method, path, and query string."""
        raw = f"{request.method}:{request.url.path}:{request.url.query}"
        # Hash long keys to keep them manageable
        if len(raw) > 256:
            digest = hashlib.sha256(raw.encode()).hexdigest()
            return f"{request.method}:{request.url.path}:hash:{digest}"
        return raw

    def _get_ttl(self, path: str) -> int:
        """Get the TTL for a given path based on route configuration."""
        # Check more specific routes first (longer prefixes match first)
        best_match = ""
        best_ttl = self._cache._default_ttl

        for route, ttl in self.ROUTE_TTL.items():
            if path.startswith(route) and len(route) > len(best_match):
                best_match = route
                best_ttl = ttl

        return best_ttl

    def _should_skip(self, path: str) -> bool:
        """Check if a path should skip caching."""
        return any(nc in path for nc in self.NO_CACHE_PATHS)

    def invalidate(self, prefix: str = "") -> int:
        """Invalidate cache entries matching a prefix. Returns count removed."""
        return self._cache.invalidate(prefix)

    @property
    def cache_stats(self) -> dict[str, Any]:
        """Return cache statistics for monitoring."""
        return self._cache.stats
