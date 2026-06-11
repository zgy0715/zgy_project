"""Token counting utility for LLM context management."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Approximate character-to-token ratio for estimation
CHARS_PER_TOKEN = 4

# Model-specific token limits
MODEL_TOKEN_LIMITS: dict[str, int] = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "llama3": 8192,
    "llama3:70b": 8192,
    "claude-3-opus": 200000,
    "claude-3-sonnet": 200000,
}


class TokenCounter:
    """Utility for counting tokens in text and managing context windows.

    Provides token counting using tiktoken when available, with
    a character-based fallback for estimation.

    Example:
        >>> counter = TokenCounter()
        >>> count = counter.count("Hello, world!")
        >>> remaining = counter.remaining_tokens("gpt-4o", messages)
    """

    def __init__(self, model: str = "gpt-4o") -> None:
        """Initialize the token counter.

        Args:
            model: The model to use for token counting.
        """
        self.model = model
        self._encoder: Any = None

        try:
            import tiktoken

            self._encoder = tiktoken.encoding_for_model(model)
            logger.debug("Initialized tiktoken encoder for model: %s", model)
        except (ImportError, KeyError):
            logger.debug("tiktoken not available or model not found, using estimation")

    def count(self, text: str) -> int:
        """Count the number of tokens in the given text.

        Args:
            text: The text to count tokens for.

        Returns:
            The estimated token count.
        """
        if self._encoder is not None:
            return len(self._encoder.encode(text))

        # Fallback: character-based estimation
        return max(1, len(text) // CHARS_PER_TOKEN)

    def count_messages(self, messages: list[dict[str, Any]]) -> int:
        """Count the total tokens in a list of messages.

        Includes overhead for message formatting (role, separators, etc.).

        Args:
            messages: List of message dictionaries with 'role' and 'content'.

        Returns:
            The estimated total token count.
        """
        total = 0
        for msg in messages:
            # Message overhead: role, separators, etc. (~4 tokens per message)
            total += 4
            total += self.count(msg.get("role", ""))
            total += self.count(msg.get("content", ""))
            if "name" in msg:
                total += self.count(msg["name"])
                total += 1  # name separator

        total += 2  # Conversation priming tokens
        return total

    def get_model_limit(self, model: str | None = None) -> int:
        """Get the maximum token limit for a model.

        Args:
            model: Model identifier. Uses instance model if None.

        Returns:
            The maximum token limit for the model.
        """
        model_name = model or self.model

        # Check exact match first
        if model_name in MODEL_TOKEN_LIMITS:
            return MODEL_TOKEN_LIMITS[model_name]

        # Check prefix match (e.g., "gpt-4o-2024-05-13" matches "gpt-4o")
        for key, limit in MODEL_TOKEN_LIMITS.items():
            if model_name.startswith(key):
                return limit

        # Default limit
        return 8192

    def remaining_tokens(
        self,
        model: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        reserved_for_response: int = 1000,
    ) -> int:
        """Calculate remaining tokens for a model's context window.

        Args:
            model: Model identifier. Uses instance model if None.
            messages: Current messages. If None, returns full limit.
            reserved_for_response: Tokens to reserve for the response.

        Returns:
            The number of remaining tokens available.
        """
        limit = self.get_model_limit(model)

        if messages is None:
            return limit - reserved_for_response

        used = self.count_messages(messages)
        remaining = limit - used - reserved_for_response

        return max(0, remaining)

    def truncate_text(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within a token limit.

        Args:
            text: The text to truncate.
            max_tokens: Maximum number of tokens to keep.

        Returns:
            The truncated text.
        """
        if self._encoder is not None:
            tokens = self._encoder.encode(text)
            if len(tokens) <= max_tokens:
                return text
            truncated_tokens = tokens[:max_tokens]
            return self._encoder.decode(truncated_tokens)

        # Fallback: character-based truncation
        max_chars = max_tokens * CHARS_PER_TOKEN
        if len(text) <= max_chars:
            return text
        return text[:max_chars] + "..."
