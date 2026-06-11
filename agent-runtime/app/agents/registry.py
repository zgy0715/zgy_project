"""Agent registry for managing all agent instances."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.agents.coder import CoderAgent
from app.agents.deployer import DeployerAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.tester import TesterAgent
from app.models.enums import AgentType

logger = logging.getLogger(__name__)

# Mapping from AgentType to its implementation class
_AGENT_CLASSES: dict[AgentType, type[BaseAgent]] = {
    AgentType.CODER: CoderAgent,
    AgentType.REVIEWER: ReviewerAgent,
    AgentType.TESTER: TesterAgent,
    AgentType.DEPLOYER: DeployerAgent,
}


class AgentRegistry:
    """Registry for managing agent instances.

    Provides a centralized store for creating, retrieving, and
    managing agent instances throughout the application lifecycle.

    Example:
        >>> registry = AgentRegistry()
        >>> agent = registry.create("my-coder", AgentType.CODER)
        >>> retrieved = registry.get("my-coder")
        >>> all_agents = registry.list_all()
    """

    def __init__(self) -> None:
        """Initialize an empty agent registry."""
        self._agents: dict[str, BaseAgent] = {}

    def create(
        self,
        name: str,
        agent_type: AgentType,
        description: str = "",
        tools: list[Any] | None = None,
        config: dict[str, Any] | None = None,
    ) -> BaseAgent:
        """Create and register a new agent instance.

        Args:
            name: Unique name for the agent.
            agent_type: The type of agent to create.
            description: Description of the agent's purpose.
            tools: Optional list of tools to provide.
            config: Optional configuration dictionary.

        Returns:
            The newly created agent instance.

        Raises:
            ValueError: If an agent with the given name already exists.
            ValueError: If the agent type is not registered.
        """
        if name in self._agents:
            raise ValueError(f"Agent with name '{name}' already exists")

        if agent_type not in _AGENT_CLASSES:
            raise ValueError(f"Unknown agent type: {agent_type}")

        agent_cls = _AGENT_CLASSES[agent_type]
        agent = agent_cls(
            name=name,
            description=description,
            tools=tools,
            config=config,
        )

        self._agents[name] = agent
        logger.info("Registered agent '%s' of type %s", name, agent_type.value)

        return agent

    def get(self, name: str) -> BaseAgent:
        """Retrieve an agent by name.

        Args:
            name: The unique name of the agent.

        Returns:
            The agent instance.

        Raises:
            KeyError: If no agent with the given name exists.
        """
        if name not in self._agents:
            raise KeyError(f"Agent '{name}' not found in registry")
        return self._agents[name]

    def list_all(self) -> list[BaseAgent]:
        """List all registered agents.

        Returns:
            List of all registered agent instances.
        """
        return list(self._agents.values())

    def list_by_type(self, agent_type: AgentType) -> list[BaseAgent]:
        """List all agents of a specific type.

        Args:
            agent_type: The agent type to filter by.

        Returns:
            List of agent instances matching the given type.
        """
        return [
            agent for agent in self._agents.values()
            if agent.agent_type == agent_type
        ]

    def remove(self, name: str) -> None:
        """Remove an agent from the registry.

        Args:
            name: The unique name of the agent to remove.

        Raises:
            KeyError: If no agent with the given name exists.
        """
        if name not in self._agents:
            raise KeyError(f"Agent '{name}' not found in registry")
        del self._agents[name]
        logger.info("Unregistered agent '%s'", name)

    def get_state(self, name: str) -> dict[str, Any]:
        """Get the state of a specific agent.

        Args:
            name: The unique name of the agent.

        Returns:
            Dictionary containing the agent's current state.

        Raises:
            KeyError: If no agent with the given name exists.
        """
        return self.get(name).get_state()

    @property
    def size(self) -> int:
        """Return the number of registered agents."""
        return len(self._agents)
