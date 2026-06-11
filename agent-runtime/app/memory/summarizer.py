"""Memory summarizer for compressing conversation history."""

import logging
from typing import Any

from app.memory.base import BaseMemory
from app.models.enums import MessageRole
from app.models.schemas import Message
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """You are a conversation summarizer for an AI agent system.
Your task is to compress conversation history while preserving key decisions,
code changes, important context, and actionable information.

Output a concise summary that would allow future interactions to continue
seamlessly without needing the full conversation history.
"""


class MemorySummarizer:
    """Compresses conversation history into concise summaries using the LLM.

    When conversation history grows too long, the summarizer condenses
    older messages into a summary to reduce token usage while preserving
    key context and decisions.

    Example:
        >>> summarizer = MemorySummarizer()
        >>> await summarizer.summarize(memory, max_messages=10)
    """

    def __init__(
        self,
        max_messages_before_summary: int = 30,
        llm_service: LLMService | None = None,
    ) -> None:
        """Initialize the summarizer.

        Args:
            max_messages_before_summary: Number of messages to trigger
                a summarization of older messages.
            llm_service: LLM service for generating summaries; created lazily if omitted.
        """
        self.max_messages_before_summary = max_messages_before_summary
        self._llm_service: LLMService | None = llm_service

    @property
    def llm(self) -> LLMService:
        """Lazy-initialized LLM service."""
        if self._llm_service is None:
            self._llm_service = LLMService()
        return self._llm_service

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

        # Generate summary using LLM
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
        """Generate a summary for the given conversation text using the LLM.

        Args:
            conversation_text: Formatted conversation to summarize.

        Returns:
            The generated summary string.
        """
        try:
            messages = [
                Message(role=MessageRole.SYSTEM, content=SUMMARY_SYSTEM_PROMPT),
                Message(role=MessageRole.USER, content=(
                    f"Summarize the following conversation history concisely.\n\n"
                    f"Conversation:\n{conversation_text}\n\n"
                    f"Focus on:\n"
                    f"1. Key decisions made\n"
                    f"2. Code changes and artifacts\n"
                    f"3. Important context for future tasks\n"
                    f"4. Outstanding issues or next steps"
                )),
            ]

            summary = await self.llm.complete(
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )

            return summary

        except Exception as e:
            logger.warning("LLM summarization failed, using extractive fallback: %s", e)
            # Fallback: simple extractive summary
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
            role = msg.role.value if hasattr(msg.role, 'value') else str(msg.role)
            content = msg.content[:500]  # Truncate long messages
            if len(msg.content) > 500:
                content += "..."
            lines.append(f"[{role}]: {content}")
        return "\n".join(lines)
