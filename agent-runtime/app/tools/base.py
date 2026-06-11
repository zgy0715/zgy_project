"""Base tool class defining the interface for agent tools."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ToolResult:
    """Result of a tool execution.

    Attributes:
        success: Whether the tool execution was successful.
        output: The output data from the tool.
        error: Error message if execution failed.
        metadata: Additional metadata about the execution.
    """

    success: bool
    output: Any = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseTool(ABC):
    """Abstract base class for all agent tools.

    Tools are the primary way agents interact with the external
    environment (filesystem, terminal, APIs, etc.).

    Attributes:
        name: Unique identifier for the tool.
        description: Human-readable description of what the tool does.
    """

    def __init__(self, name: str, description: str) -> None:
        """Initialize the tool.

        Args:
            name: Unique identifier for the tool.
            description: Description of the tool's functionality.
        """
        self.name = name
        self.description = description

    @abstractmethod
    async def run(self, **kwargs: Any) -> ToolResult:
        """Execute the tool with the given arguments.

        Args:
            **kwargs: Tool-specific arguments.

        Returns:
            ToolResult containing the execution output or error.
        """
        ...

    async def __call__(self, **kwargs: Any) -> ToolResult:
        """Allow the tool to be called as a function.

        Args:
            **kwargs: Tool-specific arguments.

        Returns:
            ToolResult containing the execution output or error.
        """
        return await self.run(**kwargs)

    def get_schema(self) -> dict[str, Any]:
        """Return the JSON schema for the tool's input parameters.

        Used for LLM function calling and tool documentation.

        Returns:
            Dictionary describing the tool's parameter schema.
        """
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        }

    def __repr__(self) -> str:
        """Return a string representation of the tool."""
        return f"{self.__class__.__name__}(name={self.name!r})"
