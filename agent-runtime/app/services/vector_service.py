"""Vector engine service for semantic search via pybind11 or HTTP."""

import asyncio
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Short timeouts for development when engine may not be running
_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=2.0)


def _make_client(timeout: httpx.Timeout = _HTTP_TIMEOUT) -> httpx.AsyncClient:
    """Create an httpx AsyncClient with SSL verification disabled (for local dev)."""
    try:
        return httpx.AsyncClient(timeout=timeout, verify=False)
    except Exception as exc:
        logger.warning("Failed to create httpx client with SSL: %s", exc)
        return httpx.AsyncClient(timeout=timeout, verify=False)


class VectorService:
    """Service for interacting with the C++ vector engine.

    Provides embedding generation, indexing, and semantic search
    capabilities through the vector engine. Supports both pybind11
    direct binding and HTTP API communication modes.

    Example:
        >>> service = VectorService()
        >>> embedding = await service.embed("hello world")
        >>> results = await service.search("hello", top_k=5)
    """

    def __init__(self) -> None:
        """Initialize the vector service with configuration."""
        settings = get_settings()
        self._config = settings.vector
        self._engine_url = self._config.engine_url
        self._embedding_model = self._config.embedding_model
        self._embedding_dim = self._config.embedding_dim

        # Try to initialize pybind11 binding
        self._native_engine: Any = None
        self._use_native = False

        try:
            # TODO: Import pybind11 module when available
            # import vector_engine
            # self._native_engine = vector_engine.Engine(self._embedding_dim)
            # self._use_native = True
            logger.info("Vector service using HTTP API mode")
        except ImportError:
            logger.info("Native vector engine not available, using HTTP API mode")

    async def embed(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text.

        Args:
            text: The text to generate an embedding for.

        Returns:
            A list of floats representing the embedding vector.
        """
        if self._use_native and self._native_engine:
            return self._native_engine.embed(text)

        try:
            async with _make_client() as client:
                response = await client.post(
                    f"{self._engine_url}/api/v1/embed",
                    json={"text": text, "model": self._embedding_model},
                )
                response.raise_for_status()
                data = response.json()

            embedding = data.get("embedding", [])
            logger.debug("Generated embedding: %d dims", len(embedding))
            return embedding

        except Exception as e:
            logger.warning("Embedding generation failed: %s (using zero vector)", str(e)[:80])
            # Return zero vector as fallback
            return [0.0] * self._embedding_dim

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts.

        Args:
            texts: List of texts to generate embeddings for.

        Returns:
            List of embedding vectors.
        """
        if self._use_native and self._native_engine:
            return self._native_engine.embed_batch(texts)

        try:
            async with _make_client() as client:
                response = await client.post(
                    f"{self._engine_url}/api/v1/embed/batch",
                    json={"texts": texts, "model": self._embedding_model},
                )
                response.raise_for_status()
                data = response.json()

            return data.get("embeddings", [])

        except Exception as e:
            logger.error("Batch embedding failed: %s", str(e))
            return [[0.0] * self._embedding_dim for _ in texts]

    async def index(
        self,
        documents: list[dict[str, Any]],
        collection: str = "default",
    ) -> int:
        """Index documents for semantic search.

        Args:
            documents: List of documents with 'content' and optional 'metadata'.
            collection: Collection name to index into.

        Returns:
            Number of documents indexed.
        """
        if self._use_native and self._native_engine:
            return self._native_engine.index(documents, collection)

        try:
            async with _make_client(httpx.Timeout(30.0, connect=2.0)) as client:
                response = await client.post(
                    f"{self._engine_url}/api/v1/index",
                    json={
                        "documents": documents,
                        "collection": collection,
                        "index_type": self._config.index_type,
                    },
                )
                response.raise_for_status()
                data = response.json()

            count = data.get("indexed", 0)
            logger.info("Indexed %d documents into collection '%s'", count, collection)
            return count

        except Exception as e:
            logger.error("Indexing failed: %s", str(e))
            return 0

    async def search(
        self,
        query: str,
        top_k: int = 10,
        collection: str = "default",
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Perform semantic search.

        Args:
            query: Search query string.
            top_k: Maximum number of results.
            collection: Collection to search in.
            filters: Optional metadata filters.

        Returns:
            List of search results with content, score, and metadata.
        """
        if self._use_native and self._native_engine:
            return self._native_engine.search(query, top_k, collection, filters)

        try:
            async with _make_client() as client:
                response = await client.post(
                    f"{self._engine_url}/api/v1/search",
                    json={
                        "query": query,
                        "top_k": top_k,
                        "collection": collection,
                        "filters": filters or {},
                    },
                )
                response.raise_for_status()
                data = response.json()

            results = data.get("results", [])
            logger.debug("Search returned %d results for: %s", len(results), query[:50])
            return results

        except Exception as e:
            logger.error("Search failed: %s", str(e))
            return []
