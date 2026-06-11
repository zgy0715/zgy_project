"""Agent-related API endpoints: create, execute, and query agent state."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.agents.registry import AgentRegistry
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

# Global agent registry instance
_registry: AgentRegistry | None = None


def _get_registry() -> AgentRegistry:
    """Get or create the global agent registry instance."""
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(request: AgentCreateRequest) -> AgentResponse:
    """Create a new agent instance via the AgentRegistry.

    Args:
        request: Agent creation parameters.

    Returns:
        AgentResponse with the created agent details.
    """
    from datetime import datetime

    registry = _get_registry()
    agent = registry.create(
        name=request.name,
        agent_type=request.agent_type,
        description=request.description,
        config=request.config,
    )

    state = agent.get_state()

    return AgentResponse(
        id=request.name,
        agent_type=request.agent_type,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


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
    registry = _get_registry()
    agents = registry.list_all()

    if agent_type is not None:
        agents = [a for a in agents if a.agent_type == agent_type]
    if status_filter is not None:
        agents = [a for a in agents if a.status == status_filter]

    return [
        AgentResponse(
            id=a.name,
            agent_type=a.agent_type,
            name=a.name,
            description=a.description,
            status=a.status,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in agents
    ]


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
    registry = _get_registry()
    try:
        agent = registry.get(agent_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )

    state = agent.get_state()
    return AgentStateResponse(
        id=agent_id,
        agent_type=agent.agent_type,
        name=agent.name,
        status=agent.status,
        messages=agent.messages,
        current_task=agent.current_task,
        artifacts=agent.artifacts,
        metadata=state,
    )


@router.post("/{agent_id}/execute", response_model=AgentExecuteResponse)
async def execute_agent_task(
    agent_id: str,
    request: AgentExecuteRequest,
) -> AgentExecuteResponse:
    """Execute a task on the specified agent.

    Runs the full agent lifecycle (plan -> execute -> reflect -> respond)
    using the LLM-powered agent implementation.

    Args:
        agent_id: Unique identifier of the agent.
        request: Task execution parameters.

    Returns:
        AgentExecuteResponse with execution results.

    Raises:
        HTTPException: If agent is not found.
    """
    registry = _get_registry()
    try:
        agent = registry.get(agent_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )

    logger.info("Executing task on agent %s: %s", agent_id, request.task)

    try:
        result = await agent.run(
            task=request.task,
            context=request.context,
        )

        return AgentExecuteResponse(
            agent_id=agent_id,
            status=TaskStatus.COMPLETED,
            result=result,
            artifacts=agent.artifacts,
            error=None,
        )

    except Exception as e:
        logger.error("Agent %s execution failed: %s", agent_id, str(e))
        return AgentExecuteResponse(
            agent_id=agent_id,
            status=TaskStatus.FAILED,
            result=None,
            artifacts=agent.artifacts,
            error=str(e),
        )


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: str) -> None:
    """Delete an agent instance from the registry.

    Args:
        agent_id: Unique identifier of the agent.

    Raises:
        HTTPException: If agent is not found.
    """
    registry = _get_registry()
    try:
        registry.remove(agent_id)
        logger.info("Deleted agent %s", agent_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )
