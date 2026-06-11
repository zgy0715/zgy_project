"""Base Agent abstract class defining the agent lifecycle.

Lifecycle: init -> plan -> execute -> reflect -> respond
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.memory.base import BaseMemory
from app.memory.short_term import ShortTermMemory
from app.models.enums import AgentType, MessageRole, TaskStatus
from app.models.schemas import Message
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for all agents in the DeepAgent system.

    Defines the standard lifecycle that every agent follows:
    1. init - Initialize agent with configuration and tools
    2. plan - Analyze the task and create an execution plan
    3. execute - Execute the plan using available tools
    4. reflect - Review the execution results for quality
    5. respond - Format and return the final response

    Attributes:
        agent_type: The type identifier for this agent.
        name: Human-readable name of the agent.
        description: Description of the agent's capabilities.
        tools: List of tools available to this agent.
        memory: Memory instance for conversation history.
        status: Current task status of the agent.
    """

    def __init__(
        self,
        name: str,
        description: str = "",
        tools: list[BaseTool] | None = None,
        memory: BaseMemory | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the agent.

        Args:
            name: Human-readable name for this agent instance.
            description: Description of the agent's capabilities.
            tools: List of tools available to this agent.
            memory: Memory backend; defaults to ShortTermMemory.
            config: Additional configuration parameters.
        """
        self.name = name
        self.description = description
        self.tools: list[BaseTool] = tools or []
        self.memory: BaseMemory = memory or ShortTermMemory()
        self.config: dict[str, Any] = config or {}
        self.status: TaskStatus = TaskStatus.PENDING
        self.messages: list[Message] = []
        self.current_task: str | None = None
        self.artifacts: list[dict[str, Any]] = []
        self.created_at: datetime = datetime.utcnow()
        self.updated_at: datetime = datetime.utcnow()

        logger.info("Initialized agent %s of type %s", name, self.agent_type)

    @property
    @abstractmethod
    def agent_type(self) -> AgentType:
        """Return the agent type identifier."""
        ...

    @property
    def tool_map(self) -> dict[str, BaseTool]:
        """Return a mapping of tool names to tool instances."""
        return {tool.name: tool for tool in self.tools}

    async def run(self, task: str, context: dict[str, Any] | None = None) -> str:
        """Execute the full agent lifecycle for a given task.

        Args:
            task: The task description to execute.
            context: Additional context for task execution.

        Returns:
            The final response string.
        """
        self.current_task = task
        self.status = TaskStatus.PLANNING
        self.updated_at = datetime.utcnow()

        try:
            # Step 1: Plan
            plan = await self.plan(task, context or {})
            logger.info("Agent %s created plan: %s", self.name, plan[:100])

            # Step 2: Execute
            self.status = TaskStatus.EXECUTING
            execution_result = await self.execute(plan, context or {})
            logger.info("Agent %s executed plan", self.name)

            # Step 3: Reflect
            self.status = TaskStatus.REVIEWING
            reflection = await self.reflect(execution_result)
            logger.info("Agent %s completed reflection", self.name)

            # Step 4: Respond
            self.status = TaskStatus.COMPLETED
            response = await self.respond(reflection)
            logger.info("Agent %s generated response", self.name)

            return response

        except Exception as e:
            self.status = TaskStatus.FAILED
            logger.error("Agent %s failed: %s", self.name, str(e))
            raise

    @abstractmethod
    async def plan(self, task: str, context: dict[str, Any]) -> str:
        """Analyze the task and create an execution plan.

        Args:
            task: The task description.
            context: Additional context for planning.

        Returns:
            A string describing the execution plan.
        """
        ...

    @abstractmethod
    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the plan using available tools.

        Args:
            plan: The execution plan from the plan step.
            context: Additional context for execution.

        Returns:
            A string describing the execution results.
        """
        ...

    @abstractmethod
    async def reflect(self, execution_result: str) -> str:
        """Review execution results for quality and completeness.

        Args:
            execution_result: The result from the execute step.

        Returns:
            A refined result after reflection.
        """
        ...

    async def respond(self, reflection: str) -> str:
        """Format the final response from the reflection.

        Args:
            reflection: The refined result from the reflect step.

        Returns:
            The formatted final response string.
        """
        self.updated_at = datetime.utcnow()

        # Store the conversation in memory
        await self.memory.add(Message(
            role=MessageRole.ASSISTANT,
            content=reflection,
        ))

        return reflection

    async def use_tool(self, tool_name: str, **kwargs: Any) -> Any:
        """Execute a tool by name with the given arguments.

        Args:
            tool_name: Name of the tool to execute.
            **kwargs: Arguments to pass to the tool.

        Returns:
            The tool execution result.

        Raises:
            ValueError: If the tool is not found.
        """
        if tool_name not in self.tool_map:
            raise ValueError(f"Tool '{tool_name}' not available for agent {self.name}")

        tool = self.tool_map[tool_name]
        logger.info("Agent %s using tool %s", self.name, tool_name)

        result = await tool.run(**kwargs)

        # Record tool usage in memory
        await self.memory.add(Message(
            role=MessageRole.TOOL,
            content=str(result),
            name=tool_name,
        ))

        return result

    def get_state(self) -> dict[str, Any]:
        """Return the current state of the agent as a dictionary.

        Returns:
            Dictionary containing agent state information.
        """
        return {
            "name": self.name,
            "agent_type": self.agent_type.value,
            "description": self.description,
            "status": self.status.value,
            "current_task": self.current_task,
            "artifacts": self.artifacts,
            "tools": [t.name for t in self.tools],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
