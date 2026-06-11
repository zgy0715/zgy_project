"""Pydantic data models for request/response validation and Agent state."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import AgentType, MessageRole, TaskStatus, WorkflowStatus


# --- Message Models ---


class Message(BaseModel):
    """A single message in the conversation."""

    role: MessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# --- Agent Models ---


class AgentCreateRequest(BaseModel):
    """Request body for creating a new agent."""

    agent_type: AgentType
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    config: dict[str, Any] = Field(default_factory=dict)
    project_id: str | None = None


class AgentResponse(BaseModel):
    """Response body for agent information."""

    id: str
    agent_type: AgentType
    name: str
    description: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime


class AgentStateResponse(BaseModel):
    """Response body for agent state including conversation history."""

    id: str
    agent_type: AgentType
    name: str
    status: TaskStatus
    messages: list[Message] = Field(default_factory=list)
    current_task: str | None = None
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentExecuteRequest(BaseModel):
    """Request body for executing a task on an agent."""

    task: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)
    parent_workflow_id: str | None = None


class AgentExecuteResponse(BaseModel):
    """Response body for agent task execution."""

    agent_id: str
    status: TaskStatus
    result: str | None = None
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None


# --- Workflow Models ---


class WorkflowNode(BaseModel):
    """A node in the workflow DAG."""

    id: str
    agent_type: AgentType
    name: str
    config: dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    """An edge in the workflow DAG."""

    source: str
    target: str
    condition: str | None = None


class WorkflowCreateRequest(BaseModel):
    """Request body for creating a new workflow."""

    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    nodes: list[WorkflowNode] = Field(min_length=1)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    project_id: str | None = None


class WorkflowResponse(BaseModel):
    """Response body for workflow information."""

    id: str
    name: str
    description: str
    status: WorkflowStatus
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    created_at: datetime
    updated_at: datetime


class WorkflowExecutionRequest(BaseModel):
    """Request body for executing a workflow."""

    input_task: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class WorkflowExecutionResponse(BaseModel):
    """Response body for workflow execution result."""

    workflow_id: str
    status: WorkflowStatus
    results: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


# --- Search Models ---


class SearchRequest(BaseModel):
    """Request body for semantic search."""

    query: str = Field(min_length=1)
    top_k: int = Field(default=10, ge=1, le=100)
    filters: dict[str, Any] = Field(default_factory=dict)


class SearchResult(BaseModel):
    """A single search result."""

    content: str
    score: float
    source: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Response body for semantic search."""

    query: str
    results: list[SearchResult]
    total: int


# --- Health Models ---


class HealthResponse(BaseModel):
    """Response body for health check."""

    status: str = "healthy"
    version: str
    uptime_seconds: float = 0.0
    services: dict[str, str] = Field(default_factory=dict)
