"""Pytest configuration and shared fixtures."""

import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio

from app.agents.base import BaseAgent
from app.agents.coder import CoderAgent
from app.agents.registry import AgentRegistry
from app.memory.short_term import ShortTermMemory
from app.models.enums import AgentType, TaskStatus
from app.models.schemas import Message, MessageRole


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def short_term_memory() -> ShortTermMemory:
    """Provide a fresh ShortTermMemory instance."""
    return ShortTermMemory(window_size=10)


@pytest.fixture
def sample_messages() -> list[Message]:
    """Provide sample messages for testing."""
    return [
        Message(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        Message(role=MessageRole.USER, content="Hello, how are you?"),
        Message(role=MessageRole.ASSISTANT, content="I'm doing well, thank you!"),
    ]


@pytest.fixture
def coder_agent() -> CoderAgent:
    """Provide a CoderAgent instance for testing."""
    return CoderAgent(name="test-coder", description="Test coder agent")


@pytest.fixture
def agent_registry() -> AgentRegistry:
    """Provide a fresh AgentRegistry instance."""
    return AgentRegistry()


@pytest.fixture
def mock_llm_service() -> AsyncMock:
    """Provide a mock LLM service."""
    service = AsyncMock()
    service.complete = AsyncMock(return_value="Mock LLM response")
    service.stream = AsyncMock()
    return service


@pytest.fixture
def sample_workflow_state() -> dict:
    """Provide a sample workflow state for testing."""
    return {
        "task": "Implement a REST API endpoint",
        "context": {"project_id": "test-project"},
        "current_agent": "",
        "iteration": 0,
        "max_iterations": 3,
        "status": "pending",
        "plan": "",
        "code_output": "",
        "review_output": "",
        "test_output": "",
        "deploy_output": "",
        "messages": [],
        "artifacts": [],
        "errors": [],
    }
