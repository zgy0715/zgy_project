"""Memory summarizer for compressing conversation history."""

import logging
from typing import Any

from app.memory.base import BaseMemory
from app.memory.short_term import ShortTermMemory
from app.models.schemas import Message, MessageRole

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """Summarize the following conversation history concisely,
preserving key decisions, code changes, and important context.
Focus on actionable information that would be needed for future tasks.

Conversation:
{conversation}
"""


class MemorySummarizer:
    """Compresses conversation history into concise summaries.

    When conversation history grows too long, the summarizer condenses
    older messages into a summary to reduce token usage while preserving
    key context and decisions.

    Example:
        >>> summarizer = MemorySummarizer()
        >>> await summarizer.summarize(memory, max_messages=10)
    """

    def __init__(self, max_messages_before_summary: int = 30) -> None:
        """Initialize the summarizer.

        Args:
            max_messages_before_summary: Number of messages to trigger
                a summarization of older messages.
        """
        self.max_messages_before_summary = max_messages_before_summary

    async def summarize(
        self,
        memory: BaseMemory,
        max_messages: int = 10,
    ) -> str:
        """Summarize older messages in memory to reduce context length.

        Takes messages beyond max_messages and compresses them into
        a single summary message, then replaces the old messages
        with the summary.

        Args:
            memory: The memory backend to summarize.
            max_messages: Number of recent messages to keep unsummarized.

        Returns:
            The generated summary text.
        """
        messages = await memory.get_messages()

        if len(messages) <= max_messages:
            logger.debug("No summarization needed (%d messages)", len(messages))
            return ""

        # Split into messages to summarize and messages to keep
        to_summarize = messages[:-max_messages]
        to_keep = messages[-max_messages:]

        # Generate summary
        conversation_text = self._format_conversation(to_summarize)
        summary = await self._generate_summary(conversation_text)

        logger.info(
            "Summarized %d messages into summary (%d chars)",
            len(to_summarize),
            len(summary),
        )

        # Replace memory contents: summary + kept messages
        await memory.clear()

        summary_message = Message(
            role=MessageRole.SYSTEM,
            content=f"[Conversation Summary]\n{summary}",
        )
        await memory.add(summary_message)

        for msg in to_keep:
            await memory.add(msg)

        return summary

    async def _generate_summary(self, conversation_text: str) -> str:
        """Generate a summary for the given conversation text.

        Args:
            conversation_text: Formatted conversation to summarize.

        Returns:
            The generated summary string.
        """
        # TODO: Integrate with LLM service for actual summarization
        # For now, return a simple truncation-based summary
        prompt = SUMMARY_PROMPT.format(conversation=conversation_text)

        # Placeholder: simple extractive summary
        lines = conversation_text.split("\n")
        summary_lines = lines[:min(10, len(lines))]
        summary = "\n".join(summary_lines)

        if len(lines) > 10:
            summary += f"\n... ({len(lines) - 10} more messages omitted)"

        return summary

    def _format_conversation(self, messages: list[Message]) -> str:
        """Format a list of messages into a readable conversation string.

        Args:
            messages: Messages to format.

        Returns:
            Formatted conversation text.
        """
        lines: list[str] = []
        for msg in messages:
            role = msg.role.value
            content = msg.content[:200]  # Truncate long messages
            if len(msg.content) > 200:
                content += "..."
            lines.append(f"[{role}]: {content}")
        return "\n".join(lines)
