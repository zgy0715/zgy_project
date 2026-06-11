"""Short-term conversation memory with sliding window strategy."""

import logging
from typing import Any

from app.memory.base import BaseMemory
from app.models.schemas import Message

logger = logging.getLogger(__name__)

DEFAULT_WINDOW_SIZE = 50


class ShortTermMemory(BaseMemory):
    """In-memory short-term conversation storage with sliding window.

    Keeps the most recent N messages in memory, discarding older
    messages when the window size is exceeded. Suitable for
    single-session conversations.

    Attributes:
        window_size: Maximum number of messages to retain.
        messages: Internal list of stored messages.
    """

    def __init__(self, window_size: int = DEFAULT_WINDOW_SIZE) -> None:
        """Initialize short-term memory with a sliding window.

        Args:
            window_size: Maximum number of messages to keep.
                Defaults to DEFAULT_WINDOW_SIZE.
        """
        self.window_size = window_size
        self._messages: list[Message] = []

    async def add(self, message: Message) -> None:
        """Add a message and trim to window size.

        Args:
            message: The message to store.
        """
        self._messages.append(message)

        # Trim oldest messages if exceeding window size
        if len(self._messages) > self.window_size:
            trimmed = len(self._messages) - self.window_size
            self._messages = self._messages[trimmed:]
            logger.debug("Trimmed %d older messages from short-term memory", trimmed)

    async def get_messages(self, limit: int | None = None) -> list[Message]:
        """Retrieve messages from the sliding window.

        Args:
            limit: Maximum number of messages to return.

        Returns:
            List of messages, ordered from oldest to newest.
        """
        if limit is not None:
            return self._messages[-limit:]
        return list(self._messages)

    async def search(self, query: str, top_k: int = 5) -> list[Message]:
        """Simple keyword-based search in short-term memory.

        Performs case-insensitive keyword matching against message content.
        For semantic search, use LongTermMemory with vector storage.

        Args:
            query: The search query string.
            top_k: Maximum number of results to return.

        Returns:
            List of messages matching the query, ranked by recency.
        """
        query_lower = query.lower()
        matches = [
            msg for msg in self._messages
            if query_lower in msg.content.lower()
        ]
        # Return most recent matches first
        matches.reverse()
        return matches[:top_k]

    async def clear(self) -> None:
        """Clear all stored messages."""
        self._messages.clear()
        logger.debug("Cleared short-term memory")

    @property
    def size(self) -> int:
        """Return the current number of stored messages."""
        return len(self._messages)
