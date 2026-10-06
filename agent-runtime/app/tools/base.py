"""Base tool class defining the interface for agent tools."""

import inspect
import logging
import types
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Union, get_args, get_origin

logger = logging.getLogger(__name__)

# Mapping from Python annotations to JSON Schema type names.
_JSON_TYPE_MAP: dict[Any, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def _annotation_to_json_type(annotation: Any) -> str:
    """Map a Python type annotation to a JSON Schema type name.

    Handles ``Optional[X]`` / ``X | None`` by unwrapping to ``X`` and
    parametrized generics (``list[str]``, ``dict[str, Any]``) by their
    origin type.

    Args:
        annotation: The annotation to map.

    Returns:
        One of "string", "integer", "number", "boolean", "array", "object";
        "string" when the annotation is missing or unrecognized.
    """
    if annotation is inspect.Parameter.empty or annotation is None:
        return "string"

    origin = get_origin(annotation)
    if origin is Union or origin is types.UnionType:
        non_none_args = [arg for arg in get_args(annotation) if arg is not type(None)]
        if non_none_args:
            return _annotation_to_json_type(non_none_args[0])
        return "string"

    if origin is not None:
        annotation = origin

    for python_type, json_type in _JSON_TYPE_MAP.items():
        if annotation is python_type:
            return json_type

    return "string"


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

    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the tool.

        Args:
            name: Unique identifier for the tool.
            description: Description of the tool's functionality.
            parameters: Optional explicit JSON schema for the tool's input
                parameters. When omitted, the schema is derived from the
                signature of ``run()`` by ``get_schema()``.
        """
        self.name = name
        self.description = description
        self.parameters = parameters

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
        try:
            return await self.run(**kwargs)
        except Exception as e:
            logger.error("Tool %s execution failed: %s", self.name, str(e))
            return ToolResult(success=False, error=str(e))

    def get_schema(self) -> dict[str, Any]:
        """Return the JSON schema for the tool's input parameters.

        Used for LLM function calling and tool documentation. An explicit
        schema passed to the constructor through ``parameters`` takes
        precedence; otherwise the schema is derived from the signature of
        ``run()``.

        Returns:
            Dictionary describing the tool's parameter schema.
        """
        parameters = self.parameters
        if parameters is None:
            parameters = self._build_parameters_schema()

        return {
            "name": self.name,
            "description": self.description,
            "parameters": parameters,
        }

    def _build_parameters_schema(self) -> dict[str, Any]:
        """Derive a JSON schema for the parameters of ``run()``.

        Uses ``inspect.signature`` to collect the keyword parameters,
        skipping ``self`` and variadic ``*args`` / ``**kwargs``.
        Parameters without a default are marked as required.

        Returns:
            A JSON schema object describing ``run()``'s parameters.
        """
        properties: dict[str, Any] = {}
        required: list[str] = []

        try:
            signature = inspect.signature(self.run)
        except (TypeError, ValueError):  # pragma: no cover - exotic callables
            return {"type": "object", "properties": properties, "required": required}

        for param_name, param in signature.parameters.items():
            if param_name == "self":
                continue
            if param.kind in (
                inspect.Parameter.VAR_POSITIONAL,
                inspect.Parameter.VAR_KEYWORD,
            ):
                continue

            properties[param_name] = {
                "type": _annotation_to_json_type(param.annotation),
            }
            if param.default is inspect.Parameter.empty:
                required.append(param_name)

        return {
            "type": "object",
            "properties": properties,
            "required": required,
        }

    def __repr__(self) -> str:
        """Return a string representation of the tool."""
        return f"{self.__class__.__name__}(name={self.name!r})"
