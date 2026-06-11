"""Tests for the memory system."""

import pytest

from app.memory.short_term import ShortTermMemory
from app.memory.long_term import LongTermMemory
from app.memory.summarizer import MemorySummarizer
from app.models.enums import MessageRole
from app.models.schemas import Message


class TestShortTermMemory:
    """Tests for the ShortTermMemory class."""

    @pytest.mark.asyncio
    async def test_add_and_get_messages(self, short_term_memory: ShortTermMemory) -> None:
        """Test adding and retrieving messages."""
        msg = Message(role=MessageRole.USER, content="Hello")
        await short_term_memory.add(msg)

        messages = await short_term_memory.get_messages()
        assert len(messages) == 1
        assert messages[0].content == "Hello"

    @pytest.mark.asyncio
    async def test_multiple_messages(self, short_term_memory: ShortTermMemory) -> None:
        """Test adding multiple messages."""
        for i in range(5):
            await short_term_memory.add(
                Message(role=MessageRole.USER, content=f"Message {i}")
            )

        messages = await short_term_memory.get_messages()
        assert len(messages) == 5

    @pytest.mark.asyncio
    async def test_window_size_limit(self) -> None:
        """Test that the sliding window trims old messages."""
        memory = ShortTermMemory(window_size=3)

        for i in range(5):
            await memory.add(
                Message(role=MessageRole.USER, content=f"Message {i}")
            )

        messages = await memory.get_messages()
        assert len(messages) == 3
        # Should keep the last 3 messages
        assert messages[0].content == "Message 2"
        assert messages[2].content == "Message 4"

    @pytest.mark.asyncio
    async def test_get_messages_with_limit(
        self, short_term_memory: ShortTermMemory
    ) -> None:
        """Test retrieving messages with a limit."""
        for i in range(5):
            await short_term_memory.add(
                Message(role=MessageRole.USER, content=f"Message {i}")
            )

        messages = await short_term_memory.get_messages(limit=3)
        assert len(messages) == 3
        assert messages[0].content == "Message 2"

    @pytest.mark.asyncio
    async def test_search(self, short_term_memory: ShortTermMemory) -> None:
        """Test keyword search in short-term memory."""
        await short_term_memory.add(
            Message(role=MessageRole.USER, content="Python is great")
        )
        await short_term_memory.add(
            Message(role=MessageRole.USER, content="JavaScript is also great")
        )

        results = await short_term_memory.search("Python")
        assert len(results) == 1
        assert "Python" in results[0].content

    @pytest.mark.asyncio
    async def test_clear(self, short_term_memory: ShortTermMemory) -> None:
        """Test clearing all messages."""
        await short_term_memory.add(Message(role=MessageRole.USER, content="Hello"))
        await short_term_memory.clear()
        messages = await short_term_memory.get_messages()
        assert len(messages) == 0

    @pytest.mark.asyncio
    async def test_get_context(self, short_term_memory: ShortTermMemory) -> None:
        """Test getting recent context."""
        for i in range(10):
            await short_term_memory.add(
                Message(role=MessageRole.USER, content=f"Message {i}")
            )

        context = await short_term_memory.get_context(max_messages=3)
        assert len(context) == 3
        assert context[0].content == "Message 7"

    @pytest.mark.asyncio
    async def test_count(self, short_term_memory: ShortTermMemory) -> None:
        """Test message count."""
        assert await short_term_memory.count() == 0
        await short_term_memory.add(Message(role=MessageRole.USER, content="Hello"))
        assert await short_term_memory.count() == 1


class TestLongTermMemory:
    """Tests for the LongTermMemory class."""

    @pytest.mark.asyncio
    async def test_add_and_get_messages(self) -> None:
        """Test adding and retrieving messages in long-term memory."""
        memory = LongTermMemory(project_id="test-project")
        msg = Message(role=MessageRole.USER, content="Long term message")
        await memory.add(msg)

        messages = await memory.get_messages()
        assert len(messages) == 1
        assert messages[0].content == "Long term message"

    @pytest.mark.asyncio
    async def test_search(self) -> None:
        """Test keyword search in long-term memory."""
        memory = LongTermMemory(project_id="test-project")
        await memory.add(Message(role=MessageRole.USER, content="Python code"))
        await memory.add(Message(role=MessageRole.USER, content="Rust code"))

        results = await memory.search("Python")
        assert len(results) >= 1

    @pytest.mark.asyncio
    async def test_clear(self) -> None:
        """Test clearing long-term memory."""
        memory = LongTermMemory(project_id="test-project")
        await memory.add(Message(role=MessageRole.USER, content="Hello"))
        await memory.clear()
        messages = await memory.get_messages()
        assert len(messages) == 0


class TestMemorySummarizer:
    """Tests for the MemorySummarizer class."""

    @pytest.mark.asyncio
    async def test_no_summarization_needed(self) -> None:
        """Test that summarization is skipped when messages are few."""
        memory = ShortTermMemory(window_size=50)
        for i in range(5):
            await memory.add(Message(role=MessageRole.USER, content=f"Message {i}"))

        summarizer = MemorySummarizer(max_messages_before_summary=30)
        result = await summarizer.summarize(memory, max_messages=10)
        assert result == ""  # No summarization needed

    @pytest.mark.asyncio
    async def test_summarization_triggered(self) -> None:
        """Test that summarization is triggered when messages exceed limit."""
        memory = ShortTermMemory(window_size=50)
        for i in range(15):
            await memory.add(Message(role=MessageRole.USER, content=f"Message {i}"))

        summarizer = MemorySummarizer(max_messages_before_summary=30)
        result = await summarizer.summarize(memory, max_messages=5)

        # After summarization, should have summary + 5 kept messages
        messages = await memory.get_messages()
        assert len(messages) <= 6  # 1 summary + 5 kept

    @pytest.mark.asyncio
    async def test_format_conversation(self) -> None:
        """Test conversation formatting."""
        summarizer = MemorySummarizer()
        messages = [
            Message(role=MessageRole.USER, content="Hello"),
            Message(role=MessageRole.ASSISTANT, content="Hi there!"),
        ]
        formatted = summarizer._format_conversation(messages)
        assert "[user]: Hello" in formatted
        assert "[assistant]: Hi there!" in formatted
