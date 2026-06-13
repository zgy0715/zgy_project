"""Agent-related API endpoints: create, execute, and query agent state."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agents.registry import AgentRegistry
from app.models.enums import AgentType, MessageRole, TaskStatus
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    AgentCreateRequest,
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentResponse,
    AgentStateResponse,
    ChatMessage,
    ReviewFindingResponse,
    ReviewResultResponse,
    ThinkingChainResponse,
    ThinkingStepResponse,
)
from app.services.event_service import EventService

logger = logging.getLogger(__name__)
router = APIRouter()

# Global agent registry instance
_registry: AgentRegistry | None = None

# Global event service instance for WebSocket broadcasting
_event_service: EventService | None = None


def _get_registry() -> AgentRegistry:
    """Get or create the global agent registry instance."""
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry


def _get_event_service() -> EventService:
    """Get or create the global event service instance."""
    global _event_service
    if _event_service is None:
        _event_service = EventService()
    return _event_service


def _get_agent_or_404(agent_id: str):
    """Retrieve an agent from the registry or raise 404."""
    registry = _get_registry()
    try:
        return registry.get(agent_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )


def _build_thinking_chain(agent_id: str, agent) -> ThinkingChainResponse:
    """Build a ThinkingChainResponse from an agent's thinking_steps."""
    steps = []
    for s in agent.thinking_steps:
        ts = s.get("timestamp")
        steps.append(ThinkingStepResponse(
            step=s.get("step", ""),
            thought=s.get("thought", ""),
            action=s.get("action"),
            observation=s.get("observation"),
            timestamp=datetime.fromisoformat(ts) if isinstance(ts, str) else datetime.utcnow(),
        ))
    return ThinkingChainResponse(
        agent_id=agent_id,
        agent_type=agent.agent_type.value,
        steps=steps,
        total_steps=len(steps),
    )


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(request: AgentCreateRequest) -> AgentResponse:
    """Create a new agent instance via the AgentRegistry.

    Args:
        request: Agent creation parameters.

    Returns:
        AgentResponse with the created agent details.
    """
    registry = _get_registry()
    agent = registry.create(
        name=request.name,
        agent_type=request.agent_type,
        description=request.description,
        config=request.config,
    )

    state = agent.get_state()

    return AgentResponse(
        id=str(uuid.uuid4()),
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
    agent = _get_agent_or_404(agent_id)

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
    agent = _get_agent_or_404(agent_id)

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


# --- Chat Endpoints ---


@router.post("/{agent_id}/chat", response_model=AgentChatResponse)
async def chat_with_agent(agent_id: str, request: AgentChatRequest) -> AgentChatResponse:
    """Send a chat message to an agent and get a response.

    Executes the agent lifecycle and returns the response along with
    the thinking chain for transparency.

    Args:
        agent_id: Unique identifier of the agent.
        request: Chat request with message and optional context.

    Returns:
        AgentChatResponse with the agent's reply and thinking chain.

    Raises:
        HTTPException: If agent is not found.
    """
    agent = _get_agent_or_404(agent_id)
    event_service = _get_event_service()

    from app.models.schemas import Message as SchemaMessage

    # Store user message in agent.messages
    user_msg = ChatMessage(
        role="user",
        content=request.message,
        agent_id=agent_id,
    )
    agent.messages.append(
        SchemaMessage(
            role=MessageRole.USER,
            content=request.message,
        )
    )

    # Broadcast chat started event
    await event_service.emit_agent_event(
        agent_id=agent_id,
        event_type="chat_started",
        details={"message": request.message[:200]},
    )

    try:
        # Execute agent lifecycle
        result = await agent.run(
            task=request.message,
            context=request.context,
        )

        # Build assistant chat message
        assistant_msg = ChatMessage(
            role="assistant",
            content=result,
            agent_id=agent_id,
        )

        # Build thinking chain
        thinking_chain = _build_thinking_chain(agent_id, agent)

        # Broadcast chat completed event
        await event_service.emit_agent_event(
            agent_id=agent_id,
            event_type="chat_completed",
            details={"status": agent.status.value},
        )

        return AgentChatResponse(
            agent_id=agent_id,
            message=assistant_msg,
            thinking_chain=thinking_chain,
            status=agent.status,
        )

    except Exception as e:
        logger.error("Agent %s chat failed: %s", agent_id, str(e))

        # Broadcast chat error event
        await event_service.emit_agent_event(
            agent_id=agent_id,
            event_type="chat_error",
            details={"error": str(e)},
        )

        error_msg = ChatMessage(
            role="assistant",
            content=f"Error: {str(e)}",
            agent_id=agent_id,
        )

        return AgentChatResponse(
            agent_id=agent_id,
            message=error_msg,
            thinking_chain=None,
            status=TaskStatus.FAILED,
        )


@router.post("/{agent_id}/chat/stream")
async def chat_with_agent_stream(agent_id: str, request: AgentChatRequest):
    """Stream an agent's response using Server-Sent Events.

    Yields events as the agent progresses through its lifecycle:
    - thinking: Agent is processing
    - chunk: Partial response text
    - complete: Full response ready
    - error: Something went wrong

    Args:
        agent_id: Unique identifier of the agent.
        request: Chat request with message and optional context.

    Returns:
        StreamingResponse with SSE-formatted events.
    """
    agent = _get_agent_or_404(agent_id)
    event_service = _get_event_service()

    # Store user message
    from app.models.schemas import Message as SchemaMessage

    agent.messages.append(
        SchemaMessage(
            role=MessageRole.USER,
            content=request.message,
        )
    )

    async def _stream_generator():
        full_response = ""

        try:
            # Emit thinking event for plan phase
            yield f"data: {json.dumps({'type': 'thinking', 'data': {'step': 'plan', 'thought': 'Starting task processing'}})}\n\n"

            # Emit message_start event for frontend compatibility
            yield f"data: {json.dumps({'type': 'message_start', 'data': {'messageId': f'msg-{agent_id}-{int(datetime.utcnow().timestamp())}'}})}\n\n"

            # Build messages for LLM streaming
            system_prompt = agent.prompt_templates.get_system_prompt(agent.agent_type.value)
            llm_messages = [
                SchemaMessage(role=MessageRole.SYSTEM, content=system_prompt),
                *agent.messages,
            ]

            # Stream LLM response
            async for chunk in agent.llm.stream(
                messages=llm_messages,
                temperature=0.7,
                max_tokens=4096,
            ):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'data': {'content': chunk}})}\n\n"
                # Emit content_delta event for frontend compatibility
                yield f"data: {json.dumps({'type': 'content_delta', 'data': {'content': chunk}})}\n\n"

            # Store assistant response in agent messages
            agent.messages.append(
                SchemaMessage(
                    role=MessageRole.ASSISTANT,
                    content=full_response,
                )
            )
            agent.status = TaskStatus.COMPLETED
            agent.updated_at = datetime.utcnow()

            # Broadcast completion event via WebSocket
            await event_service.emit_agent_event(
                agent_id=agent_id,
                event_type="chat_stream_completed",
                details={"response_length": len(full_response)},
            )

            # Emit complete event
            yield f"data: {json.dumps({'type': 'complete', 'data': {'content': full_response, 'agent_id': agent_id, 'status': agent.status.value}})}\n\n"

            # Emit message_end event for frontend compatibility
            yield f"data: {json.dumps({'type': 'message_end', 'data': {'content': full_response, 'agent_id': agent_id, 'status': agent.status.value}})}\n\n"

        except Exception as e:
            logger.error("Agent %s stream chat failed: %s", agent_id, str(e))
            agent.status = TaskStatus.FAILED
            # Filter sensitive information from error message
            error_msg = str(e)
            if "api_key" in error_msg.lower() or "sk-" in error_msg:
                error_msg = "LLM service error occurred"
            yield f"data: {json.dumps({'type': 'error', 'data': {'error': error_msg, 'agent_id': agent_id}})}\n\n"

    return StreamingResponse(
        _stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{agent_id}/thinking-chain", response_model=ThinkingChainResponse)
async def get_thinking_chain(agent_id: str) -> ThinkingChainResponse:
    """Get the thinking chain (chain of thought) for an agent.

    Returns all recorded thinking steps from the agent's last execution.

    Args:
        agent_id: Unique identifier of the agent.

    Returns:
        ThinkingChainResponse with all thinking steps.

    Raises:
        HTTPException: If agent is not found.
    """
    agent = _get_agent_or_404(agent_id)
    return _build_thinking_chain(agent_id, agent)


@router.get("/{agent_id}/messages", response_model=list[ChatMessage])
async def get_agent_messages(agent_id: str, limit: int = 50, offset: int = 0) -> list[ChatMessage]:
    """Get conversation history for an agent.

    Supports pagination with limit/offset.

    Args:
        agent_id: Unique identifier of the agent.
        limit: Maximum number of messages to return (default 50).
        offset: Number of messages to skip (default 0).

    Returns:
        List of ChatMessage objects.

    Raises:
        HTTPException: If agent is not found.
    """
    agent = _get_agent_or_404(agent_id)

    messages: list[ChatMessage] = []
    for msg in agent.messages[offset : offset + limit]:
        messages.append(
            ChatMessage(
                role=msg.role.value,
                content=msg.content,
                agent_id=agent_id,
                timestamp=msg.timestamp,
                metadata=msg.metadata,
            )
        )

    return messages


@router.get("/{agent_id}/review-findings", response_model=ReviewResultResponse | None)
async def get_review_findings(agent_id: str) -> ReviewResultResponse | None:
    """Get structured review findings from a Reviewer agent.

    Returns parsed review findings if the agent is a reviewer
    and has completed a review.

    Args:
        agent_id: Unique identifier of the agent.

    Returns:
        ReviewResultResponse with structured findings, or None if no review yet.

    Raises:
        HTTPException: If agent is not found or is not a Reviewer agent.
    """
    agent = _get_agent_or_404(agent_id)

    if agent.agent_type != AgentType.REVIEWER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent {agent_id} is not a Reviewer agent (type: {agent.agent_type.value})",
        )

    # Cast to ReviewerAgent to access review-specific methods
    reviewer = agent  # type: ignore[assignment]

    # Look for review artifacts
    review_artifact = None
    for artifact in agent.artifacts:
        if artifact.get("type") == "code_review":
            review_artifact = artifact
            break

    if review_artifact is None:
        return None

    # Parse the last review output from thinking steps or messages
    # Use the ReviewerAgent's _parse_review_output method
    last_assistant_msg = None
    for msg in reversed(agent.messages):
        if msg.role == MessageRole.ASSISTANT:
            last_assistant_msg = msg.content
            break

    if last_assistant_msg is None:
        return None

    review_result = reviewer._parse_review_output(last_assistant_msg)

    findings = [
        ReviewFindingResponse(
            category=f.category,
            title=f.title,
            description=f.description,
            location=f.location or None,
            suggestion=f.suggestion or None,
        )
        for f in review_result.findings
    ]

    return ReviewResultResponse(
        findings=findings,
        summary=review_result.summary,
        approved=review_result.approved,
    )
