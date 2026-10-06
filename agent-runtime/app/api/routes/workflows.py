"""Workflow API endpoints: create, execute, and query DAG-based workflows.

TODO: 数据持久化 - 当前所有工作流数据存储在内存中（_workflows 字典），
服务重启后数据将丢失。未来需要接入数据库（如 PostgreSQL）实现持久化存储，
包括工作流定义、执行状态和执行结果。
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.graph.workflow import WorkflowEngine
from app.models.enums import WorkflowStatus
from app.models.schemas import (
    WorkflowCreateRequest,
    WorkflowEdge,
    WorkflowExecutionRequest,
    WorkflowExecutionResponse,
    WorkflowNode,
    WorkflowResponse,
    WorkflowUpdateRequest,
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


def _build_workflow_response(workflow_data: dict[str, Any]) -> WorkflowResponse:
    """Build a WorkflowResponse from workflow data, ensuring proper node/edge types."""
    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])
    # Convert dicts to model instances if needed
    nodes = [WorkflowNode(**n) if isinstance(n, dict) else n for n in nodes]
    edges = [WorkflowEdge(**e) if isinstance(e, dict) else e for e in edges]
    return WorkflowResponse(
        id=workflow_data["id"],
        name=workflow_data["name"],
        description=workflow_data["description"],
        status=workflow_data["status"],
        nodes=nodes,
        edges=edges,
        created_at=workflow_data["created_at"],
        updated_at=workflow_data["updated_at"],
    )


@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(request: WorkflowCreateRequest) -> WorkflowResponse:
    """Create a new workflow from a DAG definition.

    Args:
        request: Workflow creation parameters including nodes and edges.

    Returns:
        WorkflowResponse with the created workflow details.
    """
    import uuid
    from datetime import datetime

    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow()

    workflow_data = {
        "id": workflow_id,
        "name": request.name,
        "description": request.description,
        "status": WorkflowStatus.CREATED,
        "nodes": list(request.nodes),
        "edges": list(request.edges),
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

    return [_build_workflow_response(w) for w in results]


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

    return _build_workflow_response(_workflows[workflow_id])


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    request: WorkflowUpdateRequest,
) -> WorkflowResponse:
    """Update an existing workflow definition.

    Args:
        workflow_id: Unique identifier of the workflow.
        request: Fields to update; omitted fields keep their current value.
            When provided, ``nodes``/``edges`` replace the previous definition.

    Returns:
        WorkflowResponse with the updated workflow details.

    Raises:
        HTTPException: If the workflow is not found.
    """
    from datetime import datetime

    workflow_data = _workflows.get(workflow_id)
    if workflow_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    if request.name is not None:
        workflow_data["name"] = request.name
    if request.description is not None:
        workflow_data["description"] = request.description
    # ``nodes`` and the gateway's ``definition`` key are interchangeable.
    updated_nodes = request.resolved_nodes()
    if updated_nodes is not None:
        workflow_data["nodes"] = list(updated_nodes)
    if request.edges is not None:
        workflow_data["edges"] = list(request.edges)
    if request.status is not None:
        workflow_data["status"] = request.status
    workflow_data["updated_at"] = datetime.utcnow()

    logger.info(
        "Updated workflow %s (%d nodes, %d edges)",
        workflow_id,
        len(workflow_data.get("nodes", [])),
        len(workflow_data.get("edges", [])),
    )

    return _build_workflow_response(workflow_data)


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

        # Check if the workflow has custom node/edge definitions.
        # Stored entries may be WorkflowNode/WorkflowEdge models (created through
        # this API) or plain dicts; the graph builder indexes them as mappings
        # with snake_case keys, so normalise both shapes here.
        custom_nodes = [
            node.model_dump(mode="json") if hasattr(node, "model_dump") else node
            for node in workflow_data.get("nodes", [])
        ]
        custom_edges = [
            edge.model_dump(mode="json") if hasattr(edge, "model_dump") else edge
            for edge in workflow_data.get("edges", [])
        ]

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

        # Determine the real outcome instead of assuming success: the engine
        # swallows graph-level exceptions and reports them through the returned
        # state's "status"/"errors" keys.
        raw_errors = result.get("errors")
        error_list = (
            [str(err) for err in raw_errors]
            if isinstance(raw_errors, (list, tuple))
            else []
        )
        engine_failed = (
            str(result.get("status", "")).lower() == "failed" or bool(error_list)
        )
        if engine_failed:
            error_detail = "; ".join(error_list)
            if not error_detail:
                error_detail = "Workflow graph execution reported a failed status"
            workflow_data["status"] = WorkflowStatus.FAILED
            logger.error(
                "Workflow %s graph execution failed: %s", workflow_id, error_detail
            )
            return WorkflowExecutionResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                results=result,
                error=error_detail,
            )

        workflow_data["status"] = WorkflowStatus.COMPLETED

        return WorkflowExecutionResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.COMPLETED,
            results=result,
            error=None,
        )

    except HTTPException:
        workflow_data["status"] = WorkflowStatus.FAILED
        raise
    except ValueError as e:
        # Configuration errors are actionable for the caller and contain no
        # internals (for example an unknown agent type).
        workflow_data["status"] = WorkflowStatus.FAILED
        logger.warning("Workflow %s execution rejected: %s", workflow_id, str(e))
        return WorkflowExecutionResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.FAILED,
            results={},
            error=str(e),
        )
    except Exception as e:
        workflow_data["status"] = WorkflowStatus.FAILED
        logger.exception("Workflow %s execution failed: %s", workflow_id, str(e))
        return WorkflowExecutionResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.FAILED,
            results={},
            error="Workflow execution failed due to an internal error",
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
