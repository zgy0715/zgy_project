"""Long-term project memory backed by vector storage."""

import logging
from typing import Any

from app.memory.base import BaseMemory
from app.models.schemas import Message

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
    ) -> None:
        """Initialize long-term memory with vector store configuration.

        Args:
            project_id: Identifier for the project.
            collection_name: Name of the vector store collection.
            embedding_dim: Dimension of the embedding vectors.
        """
        self.project_id = project_id
        self.collection_name = collection_name
        self.embedding_dim = embedding_dim
        self._messages: list[Message] = []  # Fallback in-memory store

        # TODO: Initialize vector store client (e.g., ChromaDB, FAISS, or custom)
        logger.info(
            "Initialized LongTermMemory for project %s (collection: %s)",
            project_id,
            collection_name,
        )

    async def add(self, message: Message) -> None:
        """Add a message to the vector store.

        Generates an embedding for the message content and stores
        it along with metadata for later semantic retrieval.

        Args:
            message: The message to store.
        """
        self._messages.append(message)

        # TODO: Generate embedding and store in vector database
        # embedding = await self._get_embedding(message.content)
        # await self._vector_store.upsert(
        #     id=str(uuid.uuid4()),
        #     embedding=embedding,
        #     metadata={"role": message.role, "timestamp": message.timestamp.isoformat()},
        #     content=message.content,
        # )

        logger.debug("Added message to long-term memory (project: %s)", self.project_id)

    async def get_messages(self, limit: int | None = None) -> list[Message]:
        """Retrieve messages from the long-term store.

        Args:
            limit: Maximum number of messages to return.

        Returns:
            List of messages, ordered from oldest to newest.
        """
        # TODO: Retrieve from vector store with proper ordering
        if limit is not None:
            return self._messages[-limit:]
        return list(self._messages)

    async def search(self, query: str, top_k: int = 5) -> list[Message]:
        """Perform semantic search across stored messages.

        Uses vector similarity to find the most relevant messages
        for the given query.

        Args:
            query: The search query string.
            top_k: Maximum number of results to return.

        Returns:
            List of messages ranked by semantic relevance.
        """
        # TODO: Generate query embedding and search vector store
        # query_embedding = await self._get_embedding(query)
        # results = await self._vector_store.search(
        #     embedding=query_embedding,
        #     top_k=top_k,
        #     filter={"project_id": self.project_id},
        # )

        # Fallback: simple keyword search
        query_lower = query.lower()
        matches = [
            msg for msg in self._messages
            if query_lower in msg.content.lower()
        ]
        return matches[:top_k]

    async def clear(self) -> None:
        """Clear all stored messages for this project."""
        self._messages.clear()

        # TODO: Clear vector store collection
        # await self._vector_store.delete_collection(self.collection_name)

        logger.info("Cleared long-term memory for project %s", self.project_id)

    async def _get_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.
        """
        # TODO: Call embedding service
        # Placeholder: return zero vector
        return [0.0] * self.embedding_dim
