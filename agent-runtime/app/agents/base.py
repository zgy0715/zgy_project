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
from app.services.llm_service import LLMService
from app.tools.base import BaseTool
from app.utils.prompt_templates import PromptTemplates

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
        llm: LLM service for generating responses.
        status: Current task status of the agent.
        default_tools: Class-level list of tool type names to auto-inject.
        thinking_steps: List of Chain-of-Thought steps recorded during execution.
    """

    # Subclasses override this to declare which tool types they need.
    # Supported values: "file_read", "file_write", "terminal", "git_ops",
    #                   "code_search", "web_search"
    default_tools: list[str] = []

    def __init__(
        self,
        name: str,
        description: str = "",
        tools: list[BaseTool] | None = None,
        memory: BaseMemory | None = None,
        llm_service: LLMService | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the agent.

        Args:
            name: Human-readable name for this agent instance.
            description: Description of the agent's capabilities.
            tools: List of tools available to this agent.
            memory: Memory backend; defaults to ShortTermMemory.
            llm_service: LLM service for generation; created lazily if omitted.
            config: Additional configuration parameters.
        """
        self.name = name
        self.description = description
        self.tools: list[BaseTool] = tools or []
        self.memory: BaseMemory = memory or ShortTermMemory()
        self._llm_service: LLMService | None = llm_service
        self.config: dict[str, Any] = config or {}
        self.status: TaskStatus = TaskStatus.PENDING
        self.messages: list[Message] = []
        self.current_task: str | None = None
        self.artifacts: list[dict[str, Any]] = []
        self.thinking_steps: list[dict[str, Any]] = []
        self.created_at: datetime = datetime.utcnow()
        self.updated_at: datetime = datetime.utcnow()

        # Auto-inject tools declared in default_tools
        self._inject_default_tools()

        logger.info("Initialized agent %s of type %s", name, self.agent_type)

    @property
    def llm(self) -> LLMService:
        """Lazy-initialized LLM service."""
        if self._llm_service is None:
            self._llm_service = LLMService()
        return self._llm_service

    @property
    def prompt_templates(self) -> type[PromptTemplates]:
        """Accessor for prompt templates."""
        return PromptTemplates

    @property
    @abstractmethod
    def agent_type(self) -> AgentType:
        """Return the agent type identifier."""
        ...

    @property
    def tool_map(self) -> dict[str, BaseTool]:
        """Return a mapping of tool names to tool instances."""
        return {tool.name: tool for tool in self.tools}

    def _inject_default_tools(self) -> None:
        """Create and inject tool instances based on default_tools.

        Only injects tools that are not already present in self.tools
        (checked by tool name). Uses lazy imports to avoid circular
        dependencies.
        """
        existing_tool_names = {tool.name for tool in self.tools}

        # Mapping from default_tools key to (tool_name, factory callable)
        _TOOL_FACTORIES: dict[str, tuple[str, Any]] = {}

        for tool_key in self.default_tools:
            if tool_key in _TOOL_FACTORIES:
                tool_name, factory = _TOOL_FACTORIES[tool_key]
            else:
                tool_name, factory = self._resolve_tool_factory(tool_key)
                _TOOL_FACTORIES[tool_key] = (tool_name, factory)

            if tool_name not in existing_tool_names:
                try:
                    instance = factory()
                    self.tools.append(instance)
                    existing_tool_names.add(tool_name)
                    logger.debug(
                        "Auto-injected tool '%s' into agent '%s'",
                        tool_name,
                        self.name,
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to auto-inject tool '%s' into agent '%s': %s",
                        tool_key,
                        self.name,
                        exc,
                    )

    @staticmethod
    def _resolve_tool_factory(tool_key: str) -> tuple[str, Any]:
        """Resolve a tool key to its (tool_name, factory) pair.

        Imports are done lazily inside this method to prevent circular
        import issues.

        Args:
            tool_key: The tool identifier from default_tools.

        Returns:
            A tuple of (tool_name, callable_that_returns_tool_instance).

        Raises:
            ValueError: If the tool_key is unknown.
        """
        if tool_key == "file_read":
            from app.tools.file_ops import FileReadTool
            return ("file_read", FileReadTool)
        elif tool_key == "file_write":
            from app.tools.file_ops import FileWriteTool
            return ("file_write", FileWriteTool)
        elif tool_key == "terminal":
            from app.tools.terminal import TerminalTool
            return ("terminal", TerminalTool)
        elif tool_key == "git_ops":
            from app.tools.git_ops import GitTool
            return ("git", GitTool)
        elif tool_key == "code_search":
            from app.tools.code_search import CodeSearchTool
            return ("code_search", CodeSearchTool)
        elif tool_key == "web_search":
            from app.tools.web_search import WebSearchTool
            return ("web_search", WebSearchTool)
        else:
            raise ValueError(f"Unknown default tool key: {tool_key}")

    def add_thinking_step(
        self,
        step: str,
        thought: str,
        action: str | None = None,
        observation: str | None = None,
    ) -> None:
        """Record a Chain-of-Thought step during agent execution.

        Args:
            step: The lifecycle phase name (e.g. "plan", "execute").
            thought: The reasoning or analysis at this step.
            action: Optional action taken during this step.
            observation: Optional observation or result from the action.
        """
        entry: dict[str, Any] = {
            "step": step,
            "thought": thought,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if action is not None:
            entry["action"] = action
        if observation is not None:
            entry["observation"] = observation

        self.thinking_steps.append(entry)
        logger.debug(
            "Agent %s thinking step [%s]: %s",
            self.name,
            step,
            thought[:100],
        )

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
        self.thinking_steps = []

        self.add_thinking_step(
            step="init",
            thought=f"Starting task: {task[:200]}",
            action=f"Agent type: {self.agent_type.value}, tools: {[t.name for t in self.tools]}",
        )

        try:
            # Step 1: Plan
            plan = await self.plan(task, context or {})
            self.add_thinking_step(
                step="plan",
                thought="Completed planning phase",
                observation=plan[:200] if plan else "",
            )
            logger.info("Agent %s created plan: %s", self.name, plan[:100])

            # Step 2: Execute
            self.status = TaskStatus.EXECUTING
            execution_result = await self.execute(plan, context or {})
            self.add_thinking_step(
                step="execute",
                thought="Completed execution phase",
                observation=execution_result[:200] if execution_result else "",
            )
            logger.info("Agent %s executed plan", self.name)

            # Step 3: Reflect
            self.status = TaskStatus.REVIEWING
            reflection = await self.reflect(execution_result)
            self.add_thinking_step(
                step="reflect",
                thought="Completed reflection phase",
                observation=reflection[:200] if reflection else "",
            )
            logger.info("Agent %s completed reflection", self.name)

            # Step 4: Respond
            self.status = TaskStatus.COMPLETED
            response = await self.respond(reflection)
            self.add_thinking_step(
                step="respond",
                thought="Task completed successfully",
            )
            logger.info("Agent %s generated response", self.name)

            return response

        except Exception as e:
            self.status = TaskStatus.FAILED
            self.add_thinking_step(
                step="error",
                thought=f"Task failed with error: {str(e)}",
                observation=str(e),
            )
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
            "thinking_steps": self.thinking_steps,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
