"""Web search tool for internet information retrieval."""

import ipaddress
import logging
import socket
from typing import Any
from urllib.parse import urlparse

from app.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)

# Maximum number of redirect hops followed manually (each hop is re-validated)
MAX_REDIRECTS = 5


class WebSearchTool(BaseTool):
    """Tool for searching the web for information.

    Provides web search capabilities for agents that need to
    look up documentation, APIs, or other online resources.
    """

    def __init__(self, search_engine: str = "duckduckgo") -> None:
        """Initialize the web search tool.

        Args:
            search_engine: The search engine backend to use.
        """
        super().__init__(
            name="web_search",
            description="Search the web for information using a search engine.",
        )
        self.search_engine = search_engine

    async def run(
        self,
        query: str,
        max_results: int = 5,
    ) -> ToolResult:
        """Search the web for the given query.

        Args:
            query: The search query string.
            max_results: Maximum number of results to return.

        Returns:
            ToolResult with search results.
        """
        try:
            import httpx

            # Placeholder: using DuckDuckGo HTML search
            search_url = "https://html.duckduckgo.com/html/"

            # Validate every URL that will actually be requested
            if not self._is_url_allowed(search_url):
                return ToolResult(
                    success=False,
                    error=f"URL blocked for security: {search_url}",
                )

            # Use a search API or scraping approach
            # TODO: Integrate with actual search API (SerpAPI, Brave Search, etc.)
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    search_url,
                    params={"q": query},
                    headers={"User-Agent": "DeepAgent/0.1.0"},
                )
                response.raise_for_status()

            # TODO: Parse HTML results properly
            results = [
                {
                    "title": f"Search result for: {query}",
                    "url": "https://example.com",
                    "snippet": "Placeholder search result snippet.",
                }
            ]

            logger.info("Web search for '%s' returned %d results", query, len(results))

            return ToolResult(
                success=True,
                output=results[:max_results],
                metadata={"query": query, "engine": self.search_engine},
            )

        except Exception as e:
            logger.error("Web search failed: %s", str(e))
            return ToolResult(
                success=False,
                error=f"Web search failed: {str(e)}",
            )

    @staticmethod
    def _is_forbidden_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
        """Check whether a resolved IP address points at an internal target.

        Args:
            ip: The IP address to inspect.

        Returns:
            True if the address must not be contacted, False otherwise.
        """
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return True

        # Unwrap IPv4-mapped IPv6 addresses (e.g. ::ffff:169.254.169.254)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
            return WebSearchTool._is_forbidden_ip(ip.ipv4_mapped)

        return False

    def _is_url_allowed(self, url: str) -> bool:
        """Check if URL is allowed (not internal/private network).

        Resolves the hostname and rejects the URL when ANY address it maps to
        is loopback, private, link-local, reserved, multicast or unspecified.
        This also catches DNS names that resolve to internal addresses.

        Args:
            url: The URL to check.

        Returns:
            True if the URL is allowed, False otherwise.
        """
        try:
            parsed = urlparse(url)
            if parsed.scheme not in ('http', 'https'):
                return False

            hostname = parsed.hostname
            if not hostname:
                return False

            # Block cloud metadata endpoints
            blocked_hostnames = [
                '169.254.169.254',  # AWS/GCP/Azure metadata
                'metadata.google.internal',
                'metadata.azure.com',
            ]
            if hostname in blocked_hostnames:
                return False

            # Block localhost
            if hostname in ('localhost', '127.0.0.1', '::1'):
                return False

            # Resolve the hostname (an IP literal resolves to itself) and
            # reject the URL if any returned address is internal.
            try:
                addr_info = socket.getaddrinfo(hostname, None)
            except (socket.gaierror, UnicodeError, OSError):
                return False

            if not addr_info:
                return False

            for entry in addr_info:
                ip_str = entry[4][0]
                try:
                    ip = ipaddress.ip_address(ip_str)
                except ValueError:
                    return False
                if self._is_forbidden_ip(ip):
                    return False

            return True
        except Exception:
            return False

    async def fetch_url(self, url: str) -> ToolResult:
        """Fetch and extract text content from a URL.

        Args:
            url: The URL to fetch.

        Returns:
            ToolResult with the page content.
        """
        if not self._is_url_allowed(url):
            return ToolResult(success=False, error=f"URL blocked for security: {url}")

        try:
            import httpx

            # Follow redirects manually (bounded) so every hop is re-validated
            # against _is_url_allowed before it is requested. Auto-following
            # would let an allowed URL redirect to an internal address.
            current_url = url
            async with httpx.AsyncClient(timeout=15.0) as client:
                for _ in range(MAX_REDIRECTS + 1):
                    if not self._is_url_allowed(current_url):
                        return ToolResult(
                            success=False,
                            error=f"URL blocked for security: {current_url}",
                        )

                    response = await client.get(current_url, follow_redirects=False)

                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            return ToolResult(
                                success=False,
                                error=f"Redirect without Location header: {current_url}",
                            )
                        current_url = str(httpx.URL(current_url).join(location))
                        continue

                    response.raise_for_status()
                    break
                else:
                    return ToolResult(
                        success=False,
                        error=f"Too many redirects (max: {MAX_REDIRECTS})",
                    )

            content = response.text
            # TODO: Parse HTML to extract text content
            # Strip basic HTML tags for now
            import re

            text = re.sub(r"<[^>]+>", " ", content)
            text = re.sub(r"\s+", " ", text).strip()

            # Limit content size
            max_chars = 10000
            if len(text) > max_chars:
                text = text[:max_chars] + "..."

            return ToolResult(
                success=True,
                output=text,
                metadata={"url": url, "final_url": current_url, "size": len(text)},
            )

        except Exception as e:
            logger.error("URL fetch failed for %s: %s", url, str(e))
            return ToolResult(success=False, error=str(e))

    def get_schema(self) -> dict[str, Any]:
        """Return the tool's parameter schema."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query string.",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return.",
                    },
                },
                "required": ["query"],
            },
        }
