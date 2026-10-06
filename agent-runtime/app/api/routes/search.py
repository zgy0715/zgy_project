"""Semantic search API endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.schemas import SearchRequest, SearchResponse, SearchResult
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)
router = APIRouter()

# Global vector service instance (fallback for callers without a lifespan)
_vector_service: VectorService | None = None


async def get_vector_service(request: Request) -> VectorService:
    """Get or create the vector service instance.

    Prefers the instance created during application startup so the lifespan
    client (native engine included) is actually reused, and only falls back to a
    lazily created singleton when no lifespan ran (for example in unit tests).
    """
    service = getattr(request.app.state, "vector_service", None)
    if service is not None:
        return service
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

    except HTTPException:
        raise
    except Exception as e:
        # Never answer 200 with an empty result on failure: the caller could not
        # distinguish "no matches" from "the vector engine is down".
        logger.exception("Semantic search failed: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Semantic search is unavailable: the vector engine could not be reached",
        ) from e


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
        # A failed index must not be reported as a successful 201 response.
        logger.exception("Indexing failed: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail="Indexing is unavailable: the vector engine could not be reached",
        ) from e
