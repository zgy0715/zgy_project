"""Code semantic search tool that calls the C++ vector engine."""

import logging
from typing import Any

from app.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class CodeSearchTool(BaseTool):
    """Tool for semantic code search using the C++ vector engine.

    Provides semantic search capabilities over codebases by leveraging
    the high-performance C++ vector engine through pybind11 or HTTP API.
    """

    def __init__(self, engine_url: str = "http://localhost:8080") -> None:
        """Initialize the code search tool.

        Args:
            engine_url: URL of the C++ vector engine service.
        """
        super().__init__(
            name="code_search",
            description="Search code semantically using the vector engine.",
        )
        self.engine_url = engine_url

    async def run(
        self,
        query: str,
        top_k: int = 10,
        language: str | None = None,
        file_pattern: str | None = None,
    ) -> ToolResult:
        """Perform semantic code search.

        Args:
            query: Natural language search query.
            top_k: Maximum number of results to return.
            language: Optional programming language filter.
            file_pattern: Optional file glob pattern filter.

        Returns:
            ToolResult with ranked search results.
        """
        try:
            import httpx

            filters: dict[str, Any] = {}
            if language:
                filters["language"] = language
            if file_pattern:
                filters["file_pattern"] = file_pattern

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.engine_url}/api/v1/search",
                    json={
                        "query": query,
                        "top_k": top_k,
                        "filters": filters,
                    },
                )
                response.raise_for_status()
                data = response.json()

            results = data.get("results", [])
            logger.info(
                "Code search for '%s' returned %d results",
                query[:50],
                len(results),
            )

            return ToolResult(
                success=True,
                output=results,
                metadata={"query": query, "total": len(results)},
            )

        except ImportError:
            logger.warning("httpx not available, returning placeholder results")
            return ToolResult(
                success=True,
                output=[
                    {
                        "content": f"Placeholder result for: {query}",
                        "score": 0.9,
                        "source": "placeholder",
                    }
                ],
                metadata={"query": query, "total": 1},
            )

        except Exception as e:
            logger.error("Code search failed: %s", str(e))
            return ToolResult(
                success=False,
                error=f"Code search failed: {str(e)}",
            )

    async def index_project(self, project_path: str) -> ToolResult:
        """Index a project for semantic search.

        Args:
            project_path: Path to the project directory to index.

        Returns:
            ToolResult indicating indexing status.
        """
        try:
            import httpx

            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.engine_url}/api/v1/index",
                    json={"project_path": project_path},
                )
                response.raise_for_status()
                data = response.json()

            logger.info("Indexed project: %s", project_path)
            return ToolResult(success=True, output=data)

        except Exception as e:
            logger.error("Project indexing failed: %s", str(e))
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
                        "description": "Natural language search query.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Maximum number of results.",
                    },
                    "language": {
                        "type": "string",
                        "description": "Programming language filter.",
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "File glob pattern filter.",
                    },
                },
                "required": ["query"],
            },
        }
