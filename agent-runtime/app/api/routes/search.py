"""Semantic search API endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.models.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)
router = APIRouter()

# Global vector service instance
_vector_service: VectorService | None = None


async def get_vector_service() -> VectorService:
    """Get or create the vector service instance."""
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service


@router.post("/", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    vector_service: VectorService = Depends(get_vector_service),
) -> SearchResponse:
    """Perform semantic search across project code and documents.

    Uses the VectorService to search via pybind11 native binding or HTTP API.

    Args:
        request: Search parameters including query and filters.
        vector_service: Vector service dependency.

    Returns:
        SearchResponse with ranked search results.
    """
    logger.info("Semantic search query: %s (top_k=%d)", request.query, request.top_k)

    try:
        results = await vector_service.search(
            query=request.query,
            top_k=request.top_k,
            filters=request.filters,
        )

        search_results = [
            SearchResult(
                content=r.get("content", ""),
                score=r.get("score", 0.0),
                source=r.get("source", "vector_engine"),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ]

        return SearchResponse(
            query=request.query,
            results=search_results,
            total=len(search_results),
        )

    except Exception as e:
        logger.error("Semantic search failed: %s", str(e))
        return SearchResponse(
            query=request.query,
            results=[],
            total=0,
        )


@router.post("/index", status_code=201)
async def index_documents(
    documents: list[dict[str, Any]],
    vector_service: VectorService = Depends(get_vector_service),
) -> dict[str, str]:
    """Index documents for semantic search.

    Args:
        documents: List of documents to index, each with content and metadata.
        vector_service: Vector service dependency.

    Returns:
        Confirmation message.
    """
    logger.info("Indexing %d documents", len(documents))

    try:
        count = await vector_service.index(
            documents=documents,
            collection="default",
        )
        return {"status": "indexed", "count": str(count)}
    except Exception as e:
        logger.error("Indexing failed: %s", str(e))
        return {"status": "failed", "count": "0"}
