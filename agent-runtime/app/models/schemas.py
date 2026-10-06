"""Pydantic data models for request/response validation and Agent state."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.enums import AgentType, MessageRole, TaskStatus, WorkflowStatus


def _request_config() -> ConfigDict:
    """Config for request models: accept camelCase *and* snake_case input.

    The frontend speaks camelCase (``agentType``, ``projectId``) and both the
    agent and workflow gateway controllers forward those JSON bodies verbatim,
    while this repo's own tests and the Java response converters use snake_case.
    ``alias_generator`` adds the camelCase alias, ``populate_by_name`` keeps the
    snake_case field names working.
    """
    return ConfigDict(alias_generator=to_camel, populate_by_name=True)


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

    model_config = _request_config()

    agent_type: AgentType
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    config: dict[str, Any] = Field(default_factory=dict)
    project_id: str | None = None


class AgentResponse(BaseModel):
    """Response body for agent information."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    agent_type: AgentType
    name: str
    description: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime


class AgentStateResponse(BaseModel):
    """Response body for agent state including conversation history."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    agent_type: AgentType
    name: str
    status: TaskStatus
    messages: list[Message] = Field(default_factory=list)
    current_task: str | None = None
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Flat mirrors of the metadata entries: the Java gateway builds its
    # AgentResponse from top-level keys (app/../AgentController.toAgentResponse),
    # so description/config/timestamps must appear at the top level too.
    description: str = ""
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AgentUpdateRequest(BaseModel):
    """Request body for updating an agent's mutable metadata.

    Every field is optional: omitted fields keep their current value. The Java
    gateway normalizes the frontend's camelCase payload to snake_case before
    forwarding it; both spellings are accepted here.
    """

    model_config = _request_config()

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    agent_type: AgentType | None = None
    config: dict[str, Any] | None = None


class AgentConfigUpdateRequest(BaseModel):
    """Request body for replacing an agent's configuration mapping.

    Two body shapes are accepted because the Java gateway forwards the
    frontend's config body verbatim (``{"temperature": 0.9}``) while other
    callers wrap it (``{"config": {"temperature": 0.9}}``). Unknown keys are
    kept so the raw shape is not silently emptied.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )

    config: dict[str, Any] | None = None

    def resolved_config(self) -> dict[str, Any]:
        """Return the configuration mapping from either accepted body shape."""
        if self.config is not None:
            return dict(self.config)
        return dict(self.model_extra or {})


class AgentExecuteRequest(BaseModel):
    """Request body for executing a task on an agent."""

    model_config = _request_config()

    task: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)
    parent_workflow_id: str | None = None


class AgentExecuteResponse(BaseModel):
    """Response body for agent task execution."""

    model_config = ConfigDict(populate_by_name=True)

    agent_id: str
    status: TaskStatus
    result: str | None = None
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None


# --- Workflow Models ---


class WorkflowNode(BaseModel):
    """A node in the workflow DAG."""

    # Request *and* nested response model: the frontend sends and reads
    # ``agentType`` (frontend/src/types/workflow.ts), and the Java gateway
    # passes node maps through unchanged, so both spellings must round-trip.
    model_config = _request_config()

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

    model_config = _request_config()

    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    nodes: list[WorkflowNode] = Field(min_length=1)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    project_id: str | None = None


class WorkflowUpdateRequest(BaseModel):
    """Request body for updating a workflow definition.

    Every field is optional: omitted fields keep their current value. Node and
    edge lists, when provided, replace the previous definition entirely.

    The Java gateway assembles the update payload itself and stores the node
    list under ``definition`` (WorkflowController.updateWorkflow), so that key is
    accepted as an alias for ``nodes``; ``status`` is forwarded when the
    frontend includes it.
    """

    model_config = _request_config()

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    nodes: list[WorkflowNode] | None = Field(default=None, min_length=1)
    definition: list[WorkflowNode] | None = Field(default=None, min_length=1)
    edges: list[WorkflowEdge] | None = None
    status: WorkflowStatus | None = None

    def resolved_nodes(self) -> list[WorkflowNode] | None:
        """Return the node list from either accepted request shape."""
        if self.nodes is not None:
            return self.nodes
        return self.definition


class WorkflowResponse(BaseModel):
    """Response body for workflow information."""

    model_config = ConfigDict(populate_by_name=True)

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

    model_config = _request_config()

    input_task: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class WorkflowExecutionResponse(BaseModel):
    """Response body for workflow execution result."""

    model_config = ConfigDict(populate_by_name=True)

    workflow_id: str
    status: WorkflowStatus
    results: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


# --- Search Models ---


class SearchRequest(BaseModel):
    """Request body for semantic search."""

    model_config = _request_config()

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

    model_config = ConfigDict(populate_by_name=True)

    query: str
    results: list[SearchResult]
    total: int


# --- Health Models ---


class HealthResponse(BaseModel):
    """Response body for health check."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = "healthy"
    version: str
    uptime_seconds: float = 0.0
    services: dict[str, str] = Field(default_factory=dict)


# --- Chat & Thinking Chain Models ---


class ChatMessage(BaseModel):
    """A chat message in agent conversation."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # "user" | "assistant" | "system"
    content: str
    agent_id: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ThinkingStepResponse(BaseModel):
    """A single thinking step from an agent."""

    model_config = ConfigDict(populate_by_name=True)

    step: str
    thought: str
    action: str | None = None
    observation: str | None = None
    timestamp: datetime


class ThinkingChainResponse(BaseModel):
    """Thinking chain for an agent execution."""

    model_config = ConfigDict(populate_by_name=True)

    agent_id: str
    agent_type: str
    steps: list[ThinkingStepResponse]
    total_steps: int


class AgentChatRequest(BaseModel):
    """Request for sending a chat message to an agent."""

    model_config = _request_config()

    message: str = Field(min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class AgentChatResponse(BaseModel):
    """Response from an agent chat."""

    model_config = ConfigDict(populate_by_name=True)

    agent_id: str
    message: ChatMessage
    thinking_chain: ThinkingChainResponse | None = None
    status: TaskStatus


class ReviewFindingResponse(BaseModel):
    """A structured review finding."""

    model_config = ConfigDict(populate_by_name=True)

    category: str  # "critical" | "warning" | "suggestion"
    title: str
    description: str
    location: str | None = None
    suggestion: str | None = None


class ReviewResultResponse(BaseModel):
    """Structured review result."""

    model_config = ConfigDict(populate_by_name=True)

    findings: list[ReviewFindingResponse]
    summary: str
    approved: bool
