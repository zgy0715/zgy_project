"""Pytest configuration and shared fixtures."""

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

# ---------------------------------------------------------------------------
# Security environment for the test session.
#
# `app.config` reads the environment when it is first imported (and caches the
# result), so these values must be set BEFORE any `app.*` import below. They are
# required because both the auth middleware and the file/terminal tools fail
# closed: without a key every request is rejected with 503, and without an
# allow-list every path is denied.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
_ALLOWED_DIRS = [_PROJECT_ROOT, tempfile.gettempdir()]

os.environ["SECURITY_INTERNAL_API_KEY"] = os.environ.get(
    "SECURITY_INTERNAL_API_KEY", "test-internal-key"
)
# Force the allow-list: tests read files from the repo and from a temp dir.
os.environ["SECURITY_ALLOWED_DIRECTORIES"] = json.dumps(_ALLOWED_DIRS)
# The terminal tool is disabled by default; the allow-list tests need it on.
os.environ["SECURITY_ALLOW_SHELL"] = "true"
# Tests must authenticate like the gateway does instead of bypassing auth.
os.environ["SECURITY_ALLOW_INSECURE_NO_AUTH"] = "false"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

from app.agents.base import BaseAgent  # noqa: E402
from app.agents.coder import CoderAgent  # noqa: E402
from app.agents.registry import AgentRegistry  # noqa: E402
from app.memory.short_term import ShortTermMemory  # noqa: E402
from app.models.enums import AgentType, TaskStatus  # noqa: E402
from app.models.schemas import Message, MessageRole  # noqa: E402


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def _isolate_shared_state() -> Generator[None, None, None]:
    """Clear the route modules' module-level stores around every test.

    ``app/api/routes/agents.py`` keeps the agent registry (keyed by agent name)
    and ``app/api/routes/workflows.py`` keeps the workflow store in module-level
    singletons, so state created by one test would otherwise be visible to the
    next one — a second ``POST /api/v1/agents/`` for ``test-coder-agent`` fails
    with "Agent with name 'test-coder-agent' already exists" and every following
    assertion in that test collapses.
    """
    from app.api.routes.agents import _get_registry
    from app.api.routes.workflows import _workflows

    def _reset() -> None:
        _get_registry().clear()
        _workflows.clear()

    _reset()
    yield
    _reset()


@pytest.fixture(scope="session")
def internal_api_key() -> str:
    """Internal API key expected by the auth middleware (set in the env above)."""
    return os.environ["SECURITY_INTERNAL_API_KEY"]


@pytest.fixture(scope="session")
def auth_headers(internal_api_key: str) -> dict[str, str]:
    """Headers that authenticate a request exactly like the API gateway does."""
    return {"X-Internal-Api-Key": internal_api_key}


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
def coder_agent(mock_llm_service: AsyncMock) -> CoderAgent:
    """Provide a CoderAgent instance with mocked LLM for testing."""
    return CoderAgent(
        name="test-coder",
        description="Test coder agent",
        llm_service=mock_llm_service,
    )


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
        "thinking_steps": [],
        "review_findings": [],
        "test_results": {},
    }
