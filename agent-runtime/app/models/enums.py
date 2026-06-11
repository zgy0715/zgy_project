"""Enum definitions for the Agent runtime."""

from enum import Enum


class AgentType(str, Enum):
    """Types of agents in the DeepAgent system."""

    CODER = "coder"
    REVIEWER = "reviewer"
    TESTER = "tester"
    DEPLOYER = "deployer"
    COORDINATOR = "coordinator"


class TaskStatus(str, Enum):
    """Status of a task execution."""

    PENDING = "pending"
    PLANNING = "planning"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageRole(str, Enum):
    """Role of a message in the conversation."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class WorkflowStatus(str, Enum):
    """Status of a workflow execution."""

    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class ToolCallStatus(str, Enum):
    """Status of a tool call execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
