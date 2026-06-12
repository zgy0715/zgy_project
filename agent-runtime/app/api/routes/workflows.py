"""Workflow API endpoints: create, execute, and query DAG-based workflows."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.graph.workflow import WorkflowEngine
from app.models.enums import WorkflowStatus
from app.models.schemas import (
    WorkflowCreateRequest,
    WorkflowExecutionRequest,
    WorkflowExecutionResponse,
    WorkflowResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory workflow store (replace with database in production)
_workflows: dict[str, dict[str, Any]] = {}

# Global workflow engine instance
_engine: WorkflowEngine | None = None


def _get_engine() -> WorkflowEngine:
    """Get or create the global workflow engine instance."""
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine


@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(request: WorkflowCreateRequest) -> WorkflowResponse:
    """Create a new workflow from a DAG definition.

    Args:
        request: Workflow creation parameters including nodes and edges.

    Returns:
        WorkflowResponse with the created workflow details.
    """
    from datetime import datetime
    import uuid

    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow()

    workflow_data = {
        "id": workflow_id,
        "name": request.name,
        "description": request.description,
        "status": WorkflowStatus.CREATED,
        "nodes": [n.model_dump() for n in request.nodes],
        "edges": [e.model_dump() for e in request.edges],
        "project_id": request.project_id,
        "created_at": now,
        "updated_at": now,
    }
    _workflows[workflow_id] = workflow_data

    logger.info("Created workflow %s with %d nodes", workflow_id, len(request.nodes))

    return WorkflowResponse(**workflow_data)


@router.get("/", response_model=list[WorkflowResponse])
async def list_workflows(
    status_filter: WorkflowStatus | None = None,
) -> list[WorkflowResponse]:
    """List all workflows with optional filtering.

    Args:
        status_filter: Filter by workflow status.

    Returns:
        List of WorkflowResponse objects.
    """
    results = list(_workflows.values())

    if status_filter is not None:
        results = [w for w in results if w["status"] == status_filter]

    return [WorkflowResponse(**w) for w in results]


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str) -> WorkflowResponse:
    """Get workflow details by ID.

    Args:
        workflow_id: Unique identifier of the workflow.

    Returns:
        WorkflowResponse with workflow details.

    Raises:
        HTTPException: If workflow is not found.
    """
    if workflow_id not in _workflows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    return WorkflowResponse(**_workflows[workflow_id])


@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: str,
    request: WorkflowExecutionRequest,
) -> WorkflowExecutionResponse:
    """Execute a workflow with the given input task.

    Uses the LangGraph WorkflowEngine to orchestrate agents through
    the DAG defined by the workflow.

    Args:
        workflow_id: Unique identifier of the workflow.
        request: Workflow execution parameters.

    Returns:
        WorkflowExecutionResponse with execution results.

    Raises:
        HTTPException: If workflow is not found.
    """
    if workflow_id not in _workflows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    workflow_data = _workflows[workflow_id]
    workflow_data["status"] = WorkflowStatus.RUNNING

    logger.info(
        "Executing workflow %s with task: %s",
        workflow_id,
        request.input_task,
    )

    try:
        engine = _get_engine()

        # Check if the workflow has custom node/edge definitions
        custom_nodes = workflow_data.get("nodes", [])
        custom_edges = workflow_data.get("edges", [])

        if custom_nodes:
            # Use custom DAG execution when workflow defines its own nodes/edges
            logger.info(
                "Using custom DAG for workflow %s (%d nodes, %d edges)",
                workflow_id,
                len(custom_nodes),
                len(custom_edges),
            )
            result = await engine.run_custom(
                workflow_def={"nodes": custom_nodes, "edges": custom_edges},
                task=request.input_task,
                context=request.context,
            )
        else:
            # Fall back to default graph
            result = await engine.run(
                task=request.input_task,
                context=request.context,
            )

        workflow_data["status"] = WorkflowStatus.COMPLETED

        return WorkflowExecutionResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.COMPLETED,
            results=result,
            error=None,
        )

    except Exception as e:
        workflow_data["status"] = WorkflowStatus.FAILED
        logger.error("Workflow %s execution failed: %s", workflow_id, str(e))
        return WorkflowExecutionResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.FAILED,
            results={},
            error=str(e),
        )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: str) -> None:
    """Delete a workflow.

    Args:
        workflow_id: Unique identifier of the workflow.

    Raises:
        HTTPException: If workflow is not found.
    """
    if workflow_id not in _workflows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    del _workflows[workflow_id]
    logger.info("Deleted workflow %s", workflow_id)
