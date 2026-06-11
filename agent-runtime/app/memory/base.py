"""Base memory class defining the interface for memory backends."""

from abc import ABC, abstractmethod
from typing import Any

from app.models.schemas import Message


class BaseMemory(ABC):
    """Abstract base class for agent memory backends.

    Defines the interface that all memory implementations must follow.
    Memory stores conversation history and provides retrieval mechanisms
    for context-aware agent interactions.
    """

    @abstractmethod
    async def add(self, message: Message) -> None:
        """Add a message to the memory store.

        Args:
            message: The message to store.
        """
        ...

    @abstractmethod
    async def get_messages(self, limit: int | None = None) -> list[Message]:
        """Retrieve messages from the memory store.

        Args:
            limit: Maximum number of messages to return. If None, return all.

        Returns:
            List of messages, ordered from oldest to newest.
        """
        ...

    @abstractmethod
    async def search(self, query: str, top_k: int = 5) -> list[Message]:
        """Search for relevant messages by query.

        Args:
            query: The search query string.
            top_k: Maximum number of results to return.

        Returns:
            List of messages ranked by relevance.
        """
        ...

    @abstractmethod
    async def clear(self) -> None:
        """Clear all stored messages."""
        ...

    async def get_context(self, max_messages: int = 10) -> list[Message]:
        """Get recent context for agent processing.

        Returns the most recent messages up to max_messages,
        useful for providing conversation context to LLM calls.

        Args:
            max_messages: Maximum number of recent messages to return.

        Returns:
            List of recent messages.
        """
        messages = await self.get_messages()
        return messages[-max_messages:] if len(messages) > max_messages else messages

    async def count(self) -> int:
        """Return the number of stored messages.

        Returns:
            The total count of messages in the store.
        """
        messages = await self.get_messages()
        return len(messages)
