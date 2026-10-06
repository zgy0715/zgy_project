"""Agent registry for managing all agent instances."""

import logging
import uuid
from datetime import datetime
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
        self._agent_ids: dict[str, str] = {}  # name -> uuid mapping

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
            supported = ", ".join(t.value for t in _AGENT_CLASSES)
            raise ValueError(
                f"Unknown agent type: {agent_type} (supported: {supported})"
            )

        agent_cls = _AGENT_CLASSES[agent_type]
        agent = agent_cls(
            name=name,
            description=description,
            tools=tools,
            config=config,
        )

        # If no tools were explicitly provided, ensure default tools are injected.
        # The base class __init__ already calls _inject_default_tools(), but this
        # guard handles edge cases where tools=[] was passed explicitly.
        if tools is None and not agent.tools:
            agent._inject_default_tools()

        self._agents[name] = agent
        self._agent_ids[name] = str(uuid.uuid4())
        logger.info(
            "Registered agent '%s' of type %s with tools: %s",
            name,
            agent_type.value,
            [t.name for t in agent.tools],
        )

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
        self._agent_ids.pop(name, None)
        logger.info("Unregistered agent '%s'", name)

    def clear(self) -> None:
        """Remove every registered agent.

        Drops all agent instances and their UUID mappings in one step. Used by
        test isolation and by shutdown paths; single removals stay available
        through :meth:`remove`.
        """
        self._agents.clear()
        self._agent_ids.clear()
        logger.info("Cleared all agents from the registry")

    def get_id(self, name: str) -> str:
        """Get the UUID of an agent by name.

        Args:
            name: The unique name of the agent.

        Returns:
            The UUID string, or the name itself if no UUID is mapped.
        """
        return self._agent_ids.get(name, name)

    def get_by_id(self, agent_id: str) -> BaseAgent | None:
        """Retrieve an agent by its UUID.

        Args:
            agent_id: The UUID of the agent.

        Returns:
            The agent instance, or None if not found.
        """
        for name, id_ in self._agent_ids.items():
            if id_ == agent_id:
                return self._agents.get(name)
        return None

    def update(
        self,
        name: str,
        *,
        new_name: str | None = None,
        description: str | None = None,
        agent_type: AgentType | None = None,
        config: dict[str, Any] | None = None,
    ) -> BaseAgent:
        """Update an existing agent's mutable metadata.

        Args:
            name: Current unique name of the agent (the registry key).
            new_name: Replacement name; the agent is re-keyed and keeps its UUID.
            description: Replacement description.
            agent_type: Replacement agent type. ``BaseAgent.agent_type`` is a
                read-only property, so a type change replaces the instance and
                carries the runtime state (messages, artifacts, thinking steps,
                status, created_at) over to the new one.
            config: Replacement configuration mapping.

        Returns:
            The updated agent instance.

        Raises:
            KeyError: If no agent with the given name exists.
            ValueError: If ``new_name`` is already taken by another agent, or the
                requested agent type is not registered.
        """
        agent = self.get(name)

        target_name = new_name if new_name is not None else agent.name
        if target_name != name and target_name in self._agents:
            raise ValueError(f"Agent with name '{target_name}' already exists")

        target_type = agent_type if agent_type is not None else agent.agent_type
        if target_type not in _AGENT_CLASSES:
            supported = ", ".join(t.value for t in _AGENT_CLASSES)
            raise ValueError(f"Unknown agent type: {target_type} (supported: {supported})")

        target_description = (
            description if description is not None else agent.description
        )
        target_config = dict(config) if config is not None else dict(agent.config)

        if target_type != agent.agent_type:
            replacement = _AGENT_CLASSES[target_type](
                name=target_name,
                description=target_description,
                config=target_config,
            )
            # Preserve conversation and provenance across the type change.
            replacement.messages = list(agent.messages)
            replacement.artifacts = list(agent.artifacts)
            replacement.thinking_steps = list(agent.thinking_steps)
            replacement.status = agent.status
            replacement.created_at = agent.created_at
            agent = replacement
        else:
            agent.name = target_name
            agent.description = target_description
            agent.config = target_config

        agent.updated_at = datetime.utcnow()

        if target_name != name:
            del self._agents[name]
            agent_id = self._agent_ids.pop(name, str(uuid.uuid4()))
            self._agents[target_name] = agent
            self._agent_ids[target_name] = agent_id
        else:
            self._agents[name] = agent

        logger.info(
            "Updated agent '%s' (now '%s', type %s)",
            name,
            agent.name,
            agent.agent_type.value,
        )
        return agent

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
