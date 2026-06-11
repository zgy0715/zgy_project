"""Agent-related API endpoints: create, execute, and query agent state."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.models.enums import AgentType, TaskStatus
from app.models.schemas import (
    AgentCreateRequest,
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentResponse,
    AgentStateResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory agent store (replace with database in production)
_agents: dict[str, dict[str, Any]] = {}


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(request: AgentCreateRequest) -> AgentResponse:
    """Create a new agent instance.

    Args:
        request: Agent creation parameters.

    Returns:
        AgentResponse with the created agent details.
    """
    from datetime import datetime
    import uuid

    agent_id = str(uuid.uuid4())
    now = datetime.utcnow()

    agent_data = {
        "id": agent_id,
        "agent_type": request.agent_type,
        "name": request.name,
        "description": request.description,
        "status": TaskStatus.PENDING,
        "config": request.config,
        "project_id": request.project_id,
        "created_at": now,
        "updated_at": now,
    }
    _agents[agent_id] = agent_data

    logger.info("Created agent %s of type %s", agent_id, request.agent_type)

    return AgentResponse(**agent_data)


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    agent_type: AgentType | None = None,
    status_filter: TaskStatus | None = None,
) -> list[AgentResponse]:
    """List all agents with optional filtering.

    Args:
        agent_type: Filter by agent type.
        status_filter: Filter by task status.

    Returns:
        List of AgentResponse objects.
    """
    results = list(_agents.values())

    if agent_type is not None:
        results = [a for a in results if a["agent_type"] == agent_type]
    if status_filter is not None:
        results = [a for a in results if a["status"] == status_filter]

    return [AgentResponse(**a) for a in results]


@router.get("/{agent_id}", response_model=AgentStateResponse)
async def get_agent_state(agent_id: str) -> AgentStateResponse:
    """Get the current state of an agent including conversation history.

    Args:
        agent_id: Unique identifier of the agent.

    Returns:
        AgentStateResponse with full agent state.

    Raises:
        HTTPException: If agent is not found.
    """
    if agent_id not in _agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )

    agent_data = _agents[agent_id]
    return AgentStateResponse(
        id=agent_data["id"],
        agent_type=agent_data["agent_type"],
        name=agent_data["name"],
        status=agent_data["status"],
        messages=agent_data.get("messages", []),
        current_task=agent_data.get("current_task"),
        artifacts=agent_data.get("artifacts", []),
        metadata=agent_data.get("config", {}),
    )


@router.post("/{agent_id}/execute", response_model=AgentExecuteResponse)
async def execute_agent_task(
    agent_id: str,
    request: AgentExecuteRequest,
) -> AgentExecuteResponse:
    """Execute a task on the specified agent.

    Args:
        agent_id: Unique identifier of the agent.
        request: Task execution parameters.

    Returns:
        AgentExecuteResponse with execution results.

    Raises:
        HTTPException: If agent is not found.
    """
    if agent_id not in _agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )

    agent_data = _agents[agent_id]
    agent_data["status"] = TaskStatus.EXECUTING
    agent_data["current_task"] = request.task

    logger.info("Executing task on agent %s: %s", agent_id, request.task)

    # TODO: Integrate with actual agent execution engine
    # For now, return a placeholder response
    agent_data["status"] = TaskStatus.COMPLETED

    return AgentExecuteResponse(
        agent_id=agent_id,
        status=TaskStatus.COMPLETED,
        result=f"Task '{request.task}' executed successfully (placeholder)",
        artifacts=[],
        error=None,
    )


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: str) -> None:
    """Delete an agent instance.

    Args:
        agent_id: Unique identifier of the agent.

    Raises:
        HTTPException: If agent is not found.
    """
    if agent_id not in _agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )

    del _agents[agent_id]
    logger.info("Deleted agent %s", agent_id)
