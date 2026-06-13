"""Unit tests for Agent classes."""

import pytest
from unittest.mock import AsyncMock

from app.agents.base import BaseAgent
from app.agents.coder import CoderAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.tester import TesterAgent
from app.agents.deployer import DeployerAgent
from app.agents.registry import AgentRegistry
from app.models.enums import AgentType, TaskStatus


class TestCoderAgent:
    """Tests for the CoderAgent class."""

    def test_agent_type(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent returns the correct agent type."""
        assert coder_agent.agent_type == AgentType.CODER

    def test_name(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent has the correct name."""
        assert coder_agent.name == "test-coder"

    def test_initial_status(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent starts with PENDING status."""
        assert coder_agent.status == TaskStatus.PENDING

    @pytest.mark.asyncio
    async def test_plan(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent can create a plan."""
        plan = await coder_agent.plan("Write a function", {})
        assert isinstance(plan, str)
        assert len(plan) > 0

    @pytest.mark.asyncio
    async def test_execute(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent can execute a plan."""
        result = await coder_agent.execute("Plan: write code", {})
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_reflect(self, coder_agent: CoderAgent) -> None:
        """Test that CoderAgent can reflect on results."""
        result = await coder_agent.reflect("Execution result")
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_run_lifecycle(self, coder_agent: CoderAgent) -> None:
        """Test the full agent lifecycle."""
        result = await coder_agent.run("Write a hello world function")
        assert isinstance(result, str)
        assert coder_agent.status == TaskStatus.COMPLETED

    def test_get_state(self, coder_agent: CoderAgent) -> None:
        """Test that get_state returns correct state information."""
        state = coder_agent.get_state()
        assert state["name"] == "test-coder"
        assert state["agent_type"] == "coder"
        assert state["status"] == "pending"


class TestReviewerAgent:
    """Tests for the ReviewerAgent class."""

    def test_agent_type(self, mock_llm_service: AsyncMock) -> None:
        """Test that ReviewerAgent returns the correct agent type."""
        agent = ReviewerAgent(name="test-reviewer", llm_service=mock_llm_service)
        assert agent.agent_type == AgentType.REVIEWER

    @pytest.mark.asyncio
    async def test_run(self, mock_llm_service: AsyncMock) -> None:
        """Test ReviewerAgent full lifecycle with mocked LLM."""
        agent = ReviewerAgent(name="test-reviewer", llm_service=mock_llm_service)
        result = await agent.run("Review this code")
        assert isinstance(result, str)
        assert agent.status == TaskStatus.COMPLETED


class TestTesterAgent:
    """Tests for the TesterAgent class."""

    def test_agent_type(self, mock_llm_service: AsyncMock) -> None:
        """Test that TesterAgent returns the correct agent type."""
        agent = TesterAgent(name="test-tester", llm_service=mock_llm_service)
        assert agent.agent_type == AgentType.TESTER

    @pytest.mark.asyncio
    async def test_run(self, mock_llm_service: AsyncMock) -> None:
        """Test TesterAgent full lifecycle with mocked LLM."""
        agent = TesterAgent(name="test-tester", llm_service=mock_llm_service)
        result = await agent.run("Generate tests for this code")
        assert isinstance(result, str)
        assert agent.status == TaskStatus.COMPLETED


class TestDeployerAgent:
    """Tests for the DeployerAgent class."""

    def test_agent_type(self, mock_llm_service: AsyncMock) -> None:
        """Test that DeployerAgent returns the correct agent type."""
        agent = DeployerAgent(name="test-deployer", llm_service=mock_llm_service)
        assert agent.agent_type == AgentType.DEPLOYER

    @pytest.mark.asyncio
    async def test_run(self, mock_llm_service: AsyncMock) -> None:
        """Test DeployerAgent full lifecycle with mocked LLM."""
        agent = DeployerAgent(name="test-deployer", llm_service=mock_llm_service)
        result = await agent.run("Generate deployment config")
        assert isinstance(result, str)
        assert agent.status == TaskStatus.COMPLETED


class TestAgentRegistry:
    """Tests for the AgentRegistry class."""

    def test_create_agent(self, agent_registry: AgentRegistry) -> None:
        """Test creating an agent in the registry."""
        agent = agent_registry.create("my-coder", AgentType.CODER)
        assert agent.name == "my-coder"
        assert agent.agent_type == AgentType.CODER

    def test_get_agent(self, agent_registry: AgentRegistry) -> None:
        """Test retrieving an agent from the registry."""
        agent_registry.create("my-coder", AgentType.CODER)
        agent = agent_registry.get("my-coder")
        assert agent.name == "my-coder"

    def test_get_nonexistent_agent(self, agent_registry: AgentRegistry) -> None:
        """Test that getting a nonexistent agent raises KeyError."""
        with pytest.raises(KeyError):
            agent_registry.get("nonexistent")

    def test_create_duplicate_agent(self, agent_registry: AgentRegistry) -> None:
        """Test that creating a duplicate agent raises ValueError."""
        agent_registry.create("my-coder", AgentType.CODER)
        with pytest.raises(ValueError):
            agent_registry.create("my-coder", AgentType.CODER)

    def test_list_all(self, agent_registry: AgentRegistry) -> None:
        """Test listing all agents."""
        agent_registry.create("coder-1", AgentType.CODER)
        agent_registry.create("reviewer-1", AgentType.REVIEWER)
        agents = agent_registry.list_all()
        assert len(agents) == 2

    def test_list_by_type(self, agent_registry: AgentRegistry) -> None:
        """Test listing agents by type."""
        agent_registry.create("coder-1", AgentType.CODER)
        agent_registry.create("coder-2", AgentType.CODER)
        agent_registry.create("reviewer-1", AgentType.REVIEWER)
        coders = agent_registry.list_by_type(AgentType.CODER)
        assert len(coders) == 2

    def test_remove_agent(self, agent_registry: AgentRegistry) -> None:
        """Test removing an agent from the registry."""
        agent_registry.create("my-coder", AgentType.CODER)
        agent_registry.remove("my-coder")
        assert agent_registry.size == 0

    def test_remove_nonexistent_agent(self, agent_registry: AgentRegistry) -> None:
        """Test that removing a nonexistent agent raises KeyError."""
        with pytest.raises(KeyError):
            agent_registry.remove("nonexistent")

    def test_size(self, agent_registry: AgentRegistry) -> None:
        """Test registry size tracking."""
        assert agent_registry.size == 0
        agent_registry.create("coder-1", AgentType.CODER)
        assert agent_registry.size == 1
