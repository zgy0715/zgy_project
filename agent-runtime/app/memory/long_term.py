"""Long-term project memory backed by vector storage."""

import logging
import uuid
from typing import Any

from app.memory.base import BaseMemory
from app.models.schemas import Message
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


class LongTermMemory(BaseMemory):
    """Long-term memory backed by a vector store for semantic retrieval.

    Stores conversation history and project knowledge in a vector
    database, enabling semantic search across long-running projects.
    Supports persistent storage that survives across sessions.

    Attributes:
        project_id: Identifier for the project this memory belongs to.
        collection_name: Vector store collection name.
    """

    def __init__(
        self,
        project_id: str = "default",
        collection_name: str = "agent_memory",
        embedding_dim: int = 1536,
        vector_service: VectorService | None = None,
    ) -> None:
        """Initialize long-term memory with vector store configuration.

        Args:
            project_id: Identifier for the project.
            collection_name: Name of the vector store collection.
            embedding_dim: Dimension of the embedding vectors.
            vector_service: Optional vector service instance; created lazily if omitted.
        """
        self.project_id = project_id
        self.collection_name = collection_name
        self.embedding_dim = embedding_dim
        self._messages: list[Message] = []  # Fallback in-memory store
        self._vector_service: VectorService | None = vector_service

        logger.info(
            "Initialized LongTermMemory for project %s (collection: %s)",
            project_id,
            collection_name,
        )

    @property
    def vector_service(self) -> VectorService:
        """Lazy-initialized vector service."""
        if self._vector_service is None:
            self._vector_service = VectorService()
        return self._vector_service

    async def add(self, message: Message) -> None:
        """Add a message to the vector store.

        Generates an embedding for the message content and stores
        it along with metadata for later semantic retrieval.

        Args:
            message: The message to store.
        """
        self._messages.append(message)

        try:
            embedding = await self.vector_service.embed(message.content)
            await self.vector_service.index(
                documents=[{
                    "id": str(uuid.uuid4()),
                    "content": message.content,
                    "metadata": {
                        "role": message.role.value if hasattr(message.role, 'value') else str(message.role),
                        "project_id": self.project_id,
                        "collection": self.collection_name,
                    },
                }],
                collection=self.collection_name,
            )
        except Exception as e:
            logger.warning("Failed to index message in vector store: %s", e)

        logger.debug("Added message to long-term memory (project: %s)", self.project_id)

    async def get_messages(self, limit: int | None = None) -> list[Message]:
        """Retrieve messages from the long-term store.

        Args:
            limit: Maximum number of messages to return.

        Returns:
            List of messages, ordered from oldest to newest.
        """
        if limit is not None:
            return self._messages[-limit:]
        return list(self._messages)

    async def search(self, query: str, top_k: int = 5) -> list[Message]:
        """Perform semantic search across stored messages.

        Uses vector similarity to find the most relevant messages
        for the given query. Falls back to keyword search if the
        vector service is unavailable.

        Args:
            query: The search query string.
            top_k: Maximum number of results to return.

        Returns:
            List of messages ranked by semantic relevance.
        """
        try:
            results = await self.vector_service.search(
                query=query,
                top_k=top_k,
                collection=self.collection_name,
                filters={"project_id": self.project_id},
            )

            if results:
                ranked: list[Message] = []
                for r in results:
                    content = r.get("content", "")
                    # Find matching message in in-memory store
                    found = False
                    for msg in self._messages:
                        if msg.content == content:
                            ranked.append(msg)
                            found = True
                            break
                    if not found:
                        ranked.append(Message(
                            role="system",
                            content=content,
                            metadata=r.get("metadata", {}),
                        ))
                return ranked[:top_k]

        except Exception as e:
            logger.warning("Vector search failed: %s", str(e)[:80])

        # Fallback: simple keyword search on in-memory store
        query_lower = query.lower()
        matches = [
            msg for msg in self._messages
            if query_lower in msg.content.lower()
        ]
        return matches[:top_k]

    async def clear(self) -> None:
        """Clear all stored messages for this project."""
        self._messages.clear()
        logger.info("Cleared long-term memory for project %s", self.project_id)

    async def _get_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.
        """
        try:
            return await self.vector_service.embed(text)
        except Exception:
            return [0.0] * self.embedding_dim
