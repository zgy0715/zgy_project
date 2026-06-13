"""End-to-end integration tests for the Agent Runtime API.

Tests the complete API flow from agent creation through execution,
chat, and workflow orchestration.
"""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.models.enums import AgentType, TaskStatus, WorkflowStatus

# Check if LLM API key is available for live tests
HAS_LLM_KEY = bool(os.environ.get("LLM_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY"))


@pytest.fixture(scope="module")
def app():
    """Create a FastAPI application instance for testing."""
    return create_app()


@pytest.fixture(scope="module")
def client(app):
    """Create a synchronous test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.fixture
def sample_agent_payload():
    """Provide a sample agent creation payload."""
    return {
        "name": "test-coder-agent",
        "agent_type": "coder",
        "description": "A test coder agent for integration testing",
        "config": {"temperature": 0.5},
    }


@pytest.fixture
def sample_reviewer_payload():
    """Provide a sample reviewer agent creation payload."""
    return {
        "name": "test-reviewer-agent",
        "agent_type": "reviewer",
        "description": "A test reviewer agent for integration testing",
        "config": {},
    }


@pytest.fixture
def sample_workflow_payload():
    """Provide a sample workflow creation payload."""
    return {
        "name": "test-workflow",
        "description": "A test workflow for integration testing",
        "nodes": [
            {"id": "coder-node", "agent_type": "coder", "name": "Code Writer"},
            {"id": "reviewer-node", "agent_type": "reviewer", "name": "Code Reviewer"},
        ],
        "edges": [
            {"source": "coder-node", "target": "reviewer-node"},
        ],
    }


# ============================================================
# Health Endpoint Tests
# ============================================================


class TestHealthEndpoints:
    """Tests for the health check API endpoints."""

    def test_health_check(self, client):
        """GET /api/v1/health returns healthy status."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "uptime_seconds" in data
        assert "services" in data

    def test_health_check_services_structure(self, client):
        """GET /api/v1/health returns expected service keys."""
        response = client.get("/api/v1/health")
        data = response.json()
        services = data["services"]
        expected_keys = {"redis", "database", "vector_engine", "llm"}
        assert expected_keys.issubset(services.keys())

    def test_readiness_check(self, client):
        """GET /api/v1/ready returns ready status."""
        response = client.get("/api/v1/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"


# ============================================================
# Agent CRUD Tests
# ============================================================


class TestAgentCRUD:
    """Tests for agent create, list, get, and delete operations."""

    def test_create_agent(self, client, sample_agent_payload):
        """POST /api/v1/agents/ creates a new agent."""
        response = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == sample_agent_payload["name"]
        assert data["agent_type"] == "coder"
        assert data["name"] == sample_agent_payload["name"]
        assert data["status"] == "pending"
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_agent_with_all_types(self, client):
        """POST /api/v1/agents/ creates agents of each supported type."""
        for agent_type in ["coder", "reviewer", "tester", "deployer"]:
            payload = {
                "name": f"test-{agent_type}-{id(agent_type)}",
                "agent_type": agent_type,
                "description": f"Test {agent_type} agent",
            }
            response = client.post("/api/v1/agents/", json=payload)
            assert response.status_code == 201, f"Failed for agent_type={agent_type}"
            assert response.json()["agent_type"] == agent_type

    def test_create_agent_duplicate_name_fails(self, client, sample_agent_payload):
        """POST /api/v1/agents/ with duplicate name returns error."""
        # First creation succeeds
        response1 = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert response1.status_code == 201

        # Second creation with same name fails
        response2 = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert response2.status_code in (400, 409, 422, 500)

    def test_create_agent_missing_name_fails(self, client):
        """POST /api/v1/agents/ without name returns validation error."""
        payload = {"agent_type": "coder"}
        response = client.post("/api/v1/agents/", json=payload)
        assert response.status_code == 422

    def test_create_agent_missing_type_fails(self, client):
        """POST /api/v1/agents/ without agent_type returns validation error."""
        payload = {"name": "orphan-agent"}
        response = client.post("/api/v1/agents/", json=payload)
        assert response.status_code == 422

    def test_create_agent_invalid_type_fails(self, client):
        """POST /api/v1/agents/ with invalid agent_type returns validation error."""
        payload = {"name": "bad-agent", "agent_type": "nonexistent"}
        response = client.post("/api/v1/agents/", json=payload)
        assert response.status_code == 422

    def test_list_agents(self, client, sample_agent_payload):
        """GET /api/v1/agents/ returns list of agents."""
        # Create an agent first
        client.post("/api/v1/agents/", json=sample_agent_payload)

        response = client.get("/api/v1/agents/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_agents_filter_by_type(self, client):
        """GET /api/v1/agents/?agent_type=coder filters by agent type."""
        response = client.get("/api/v1/agents/?agent_type=coder")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for agent in data:
            assert agent["agent_type"] == "coder"

    def test_list_agents_filter_by_status(self, client):
        """GET /api/v1/agents/?status_filter=pending filters by status."""
        response = client.get("/api/v1/agents/?status_filter=pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for agent in data:
            assert agent["status"] == "pending"

    def test_get_agent_state(self, client, sample_agent_payload):
        """GET /api/v1/agents/{agent_id} returns agent state."""
        # Create an agent
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]
        response = client.get(f"/api/v1/agents/{agent_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == agent_id
        assert data["agent_type"] == "coder"
        assert "messages" in data
        assert "artifacts" in data

    def test_get_agent_not_found(self, client):
        """GET /api/v1/agents/{agent_id} returns 404 for unknown agent."""
        response = client.get("/api/v1/agents/nonexistent-agent")
        assert response.status_code == 404

    def test_delete_agent(self, client):
        """DELETE /api/v1/agents/{agent_id} removes the agent."""
        payload = {
            "name": "to-be-deleted",
            "agent_type": "coder",
            "description": "Agent to be deleted",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]
        delete_resp = client.delete(f"/api/v1/agents/{agent_id}")
        assert delete_resp.status_code == 204

        # Verify agent is gone
        get_resp = client.get(f"/api/v1/agents/{agent_id}")
        assert get_resp.status_code == 404

    def test_delete_agent_not_found(self, client):
        """DELETE /api/v1/agents/{agent_id} returns 404 for unknown agent."""
        response = client.delete("/api/v1/agents/nonexistent-agent")
        assert response.status_code == 404


# ============================================================
# Agent Execution Tests
# ============================================================


class TestAgentExecution:
    """Tests for agent task execution endpoint."""

    @pytest.mark.skipif(not HAS_LLM_KEY, reason="Requires LLM API key")
    def test_execute_agent_task(self, client):
        """POST /api/v1/agents/{agent_id}/execute runs a task on the agent."""
        # Create a coder agent
        payload = {
            "name": "exec-test-coder",
            "agent_type": "coder",
            "description": "Agent for execution testing",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]
        execute_resp = client.post(
            f"/api/v1/agents/{agent_id}/execute",
            json={"task": "Write a hello world function in Python"},
        )
        assert execute_resp.status_code == 200
        data = execute_resp.json()
        assert data["agent_id"] == agent_id
        assert data["status"] in ("completed", "failed")
        if data["status"] == "completed":
            assert data["result"] is not None

    def test_execute_agent_not_found(self, client):
        """POST /api/v1/agents/{agent_id}/execute returns 404 for unknown agent."""
        response = client.post(
            "/api/v1/agents/nonexistent/execute",
            json={"task": "Do something"},
        )
        assert response.status_code == 404

    def test_execute_agent_missing_task_fails(self, client, sample_agent_payload):
        """POST /api/v1/agents/{agent_id}/execute without task returns 422."""
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]
        execute_resp = client.post(
            f"/api/v1/agents/{agent_id}/execute",
            json={},
        )
        assert execute_resp.status_code == 422

    @patch("app.agents.base.BaseAgent.run", new_callable=AsyncMock)
    def test_execute_agent_mocked(self, mock_run, client):
        """POST /api/v1/agents/{agent_id}/execute with mocked LLM returns result."""
        mock_run.return_value = "Mocked execution result"

        payload = {
            "name": "mock-exec-coder",
            "agent_type": "coder",
            "description": "Agent with mocked execution",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]
        execute_resp = client.post(
            f"/api/v1/agents/{agent_id}/execute",
            json={"task": "Write a function", "context": {"language": "python"}},
        )
        assert execute_resp.status_code == 200
        data = execute_resp.json()
        assert data["agent_id"] == agent_id
        assert data["status"] == "completed"
        assert data["result"] == "Mocked execution result"


# ============================================================
# Agent Chat Tests
# ============================================================


class TestAgentChat:
    """Tests for agent chat and streaming endpoints."""

    @patch("app.agents.base.BaseAgent.run", new_callable=AsyncMock)
    def test_chat_with_agent(self, mock_run, client):
        """POST /api/v1/agents/{agent_id}/chat sends a message and gets response."""
        mock_run.return_value = "Hello! I can help you with coding tasks."

        payload = {
            "name": "chat-test-coder",
            "agent_type": "coder",
            "description": "Agent for chat testing",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]
        chat_resp = client.post(
            f"/api/v1/agents/{agent_id}/chat",
            json={"message": "Hello, can you help me?"},
        )
        assert chat_resp.status_code == 200
        data = chat_resp.json()
        assert data["agent_id"] == agent_id
        assert data["message"]["role"] == "assistant"
        assert data["message"]["content"] == "Hello! I can help you with coding tasks."
        assert "thinking_chain" in data
        assert "status" in data

    def test_chat_with_agent_not_found(self, client):
        """POST /api/v1/agents/{agent_id}/chat returns 404 for unknown agent."""
        response = client.post(
            "/api/v1/agents/nonexistent/chat",
            json={"message": "Hello"},
        )
        assert response.status_code == 404

    def test_chat_with_agent_missing_message_fails(self, client, sample_agent_payload):
        """POST /api/v1/agents/{agent_id}/chat without message returns 422."""
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]
        chat_resp = client.post(
            f"/api/v1/agents/{agent_id}/chat",
            json={},
        )
        assert chat_resp.status_code == 422

    def test_chat_stream_sse_format(self, client, sample_agent_payload):
        """POST /api/v1/agents/{agent_id}/chat/stream returns SSE format.

        Verifies the response has the correct content-type and SSE structure.
        The actual LLM streaming is mocked via the agent's llm.stream method.
        """
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]

        # Mock the LLM stream to avoid needing a real API key
        async def mock_stream(*args, **kwargs):
            yield "Hello "
            yield "from "
            yield "stream!"

        with patch.object(
            create_resp.app.state if hasattr(create_resp, "app") else None,
            "nothing",
            create=True,
        ):
            # Use the synchronous client for SSE - it reads the full response
            with client as c:
                # We need to mock at the agent level
                from app.agents.base import BaseAgent

                original_llm = BaseAgent.llm

                with patch("app.api.routes.agents._get_agent_or_404") as mock_get:
                    mock_agent = MagicMock()
                    mock_agent.agent_type = AgentType.CODER
                    mock_agent.messages = []
                    mock_agent.status = TaskStatus.PENDING
                    mock_agent.llm = MagicMock()
                    mock_agent.llm.stream = mock_stream
                    mock_agent.prompt_templates = MagicMock()
                    mock_agent.prompt_templates.get_system_prompt = MagicMock(
                        return_value="You are a coder."
                    )
                    mock_get.return_value = mock_agent

                    stream_resp = c.post(
                        f"/api/v1/agents/{agent_id}/chat/stream",
                        json={"message": "Hello stream"},
                    )
                    assert stream_resp.status_code == 200
                    assert "text/event-stream" in stream_resp.headers.get("content-type", "")

                    # Parse SSE events from response
                    content = stream_resp.text
                    events = [
                        line for line in content.split("\n") if line.startswith("data: ")
                    ]
                    assert len(events) > 0

                    # Verify at least one event is parseable JSON
                    for event in events:
                        json_str = event[len("data: "):]
                        parsed = json.loads(json_str)
                        assert "type" in parsed
                        assert "data" in parsed

    def test_chat_stream_agent_not_found(self, client):
        """POST /api/v1/agents/{agent_id}/chat/stream returns 404 for unknown agent."""
        response = client.post(
            "/api/v1/agents/nonexistent/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 404


# ============================================================
# Thinking Chain & Messages Tests
# ============================================================


class TestThinkingChainAndMessages:
    """Tests for thinking chain and message retrieval endpoints."""

    @patch("app.agents.base.BaseAgent.run", new_callable=AsyncMock)
    def test_get_thinking_chain(self, mock_run, client):
        """GET /api/v1/agents/{agent_id}/thinking-chain returns thinking steps."""
        mock_run.return_value = "Task completed"

        payload = {
            "name": "thinking-test-coder",
            "agent_type": "coder",
            "description": "Agent for thinking chain testing",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]

        # Execute a task to generate thinking steps
        client.post(
            f"/api/v1/agents/{agent_id}/execute",
            json={"task": "Write a function"},
        )

        # Get thinking chain
        tc_resp = client.get(f"/api/v1/agents/{agent_id}/thinking-chain")
        assert tc_resp.status_code == 200
        data = tc_resp.json()
        assert data["agent_id"] == agent_id
        assert data["agent_type"] == "coder"
        assert "steps" in data
        assert "total_steps" in data
        assert isinstance(data["steps"], list)

    def test_get_thinking_chain_not_found(self, client):
        """GET /api/v1/agents/{agent_id}/thinking-chain returns 404 for unknown agent."""
        response = client.get("/api/v1/agents/nonexistent/thinking-chain")
        assert response.status_code == 404

    @patch("app.agents.base.BaseAgent.run", new_callable=AsyncMock)
    def test_get_messages(self, mock_run, client):
        """GET /api/v1/agents/{agent_id}/messages returns conversation history."""
        mock_run.return_value = "Response from agent"

        payload = {
            "name": "msg-test-coder",
            "agent_type": "coder",
            "description": "Agent for messages testing",
        }
        create_resp = client.post("/api/v1/agents/", json=payload)
        assert create_resp.status_code == 201

        agent_id = payload["name"]

        # Chat with the agent to generate messages
        client.post(
            f"/api/v1/agents/{agent_id}/chat",
            json={"message": "Hello agent"},
        )

        # Get messages
        msg_resp = client.get(f"/api/v1/agents/{agent_id}/messages")
        assert msg_resp.status_code == 200
        data = msg_resp.json()
        assert isinstance(data, list)
        # Should have at least the user message we sent
        assert len(data) >= 1

    def test_get_messages_with_pagination(self, client, sample_agent_payload):
        """GET /api/v1/agents/{agent_id}/messages supports limit and offset."""
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]
        response = client.get(f"/api/v1/agents/{agent_id}/messages?limit=10&offset=0")
        assert response.status_code == 200

    def test_get_messages_not_found(self, client):
        """GET /api/v1/agents/{agent_id}/messages returns 404 for unknown agent."""
        response = client.get("/api/v1/agents/nonexistent/messages")
        assert response.status_code == 404


# ============================================================
# Review Findings Tests
# ============================================================


class TestReviewFindings:
    """Tests for review findings endpoint."""

    def test_get_review_findings_non_reviewer_fails(self, client, sample_agent_payload):
        """GET /api/v1/agents/{agent_id}/review-findings returns 400 for non-reviewer."""
        create_resp = client.post("/api/v1/agents/", json=sample_agent_payload)
        assert create_resp.status_code == 201

        agent_id = sample_agent_payload["name"]
        response = client.get(f"/api/v1/agents/{agent_id}/review-findings")
        assert response.status_code == 400

    def test_get_review_findings_reviewer_no_review(self, client, sample_reviewer_payload):
        """GET /api/v1/agents/{agent_id}/review-findings returns null when no review done."""
        create_resp = client.post("/api/v1/agents/", json=sample_reviewer_payload)
        assert create_resp.status_code == 201

        agent_id = sample_reviewer_payload["name"]
        response = client.get(f"/api/v1/agents/{agent_id}/review-findings")
        assert response.status_code == 200
        # No review has been done yet, so findings should be null
        assert response.json() is None

    def test_get_review_findings_not_found(self, client):
        """GET /api/v1/agents/{agent_id}/review-findings returns 404 for unknown agent."""
        response = client.get("/api/v1/agents/nonexistent/review-findings")
        assert response.status_code == 404


# ============================================================
# Workflow CRUD Tests
# ============================================================


class TestWorkflowCRUD:
    """Tests for workflow create, list, get, and delete operations."""

    def test_create_workflow(self, client, sample_workflow_payload):
        """POST /api/v1/workflows/ creates a new workflow."""
        response = client.post("/api/v1/workflows/", json=sample_workflow_payload)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == sample_workflow_payload["name"]
        assert data["status"] == "created"
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1

    def test_create_workflow_missing_name_fails(self, client):
        """POST /api/v1/workflows/ without name returns validation error."""
        payload = {
            "nodes": [{"id": "n1", "agent_type": "coder", "name": "Coder"}],
        }
        response = client.post("/api/v1/workflows/", json=payload)
        assert response.status_code == 422

    def test_create_workflow_empty_nodes_fails(self, client):
        """POST /api/v1/workflows/ with empty nodes returns validation error."""
        payload = {
            "name": "empty-workflow",
            "nodes": [],
        }
        response = client.post("/api/v1/workflows/", json=payload)
        assert response.status_code == 422

    def test_list_workflows(self, client, sample_workflow_payload):
        """GET /api/v1/workflows/ returns list of workflows."""
        client.post("/api/v1/workflows/", json=sample_workflow_payload)

        response = client.get("/api/v1/workflows/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_workflows_filter_by_status(self, client):
        """GET /api/v1/workflows/?status_filter=created filters by status."""
        response = client.get("/api/v1/workflows/?status_filter=created")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for wf in data:
            assert wf["status"] == "created"

    def test_get_workflow(self, client, sample_workflow_payload):
        """GET /api/v1/workflows/{workflow_id} returns workflow details."""
        create_resp = client.post("/api/v1/workflows/", json=sample_workflow_payload)
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        get_resp = client.get(f"/api/v1/workflows/{workflow_id}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["id"] == workflow_id
        assert data["name"] == sample_workflow_payload["name"]

    def test_get_workflow_not_found(self, client):
        """GET /api/v1/workflows/{workflow_id} returns 404 for unknown workflow."""
        response = client.get("/api/v1/workflows/nonexistent-id")
        assert response.status_code == 404

    def test_delete_workflow(self, client, sample_workflow_payload):
        """DELETE /api/v1/workflows/{workflow_id} removes the workflow."""
        create_resp = client.post("/api/v1/workflows/", json=sample_workflow_payload)
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        delete_resp = client.delete(f"/api/v1/workflows/{workflow_id}")
        assert delete_resp.status_code == 204

        # Verify workflow is gone
        get_resp = client.get(f"/api/v1/workflows/{workflow_id}")
        assert get_resp.status_code == 404

    def test_delete_workflow_not_found(self, client):
        """DELETE /api/v1/workflows/{workflow_id} returns 404 for unknown workflow."""
        response = client.delete("/api/v1/workflows/nonexistent-id")
        assert response.status_code == 404


# ============================================================
# Workflow Execution Tests
# ============================================================


class TestWorkflowExecution:
    """Tests for workflow execution endpoint."""

    @patch("app.graph.workflow.WorkflowEngine.run_custom", new_callable=AsyncMock)
    def test_execute_workflow(self, mock_run_custom, client, sample_workflow_payload):
        """POST /api/v1/workflows/{workflow_id}/execute runs the workflow."""
        mock_run_custom.return_value = {
            "status": "completed",
            "code_output": "def hello(): pass",
            "review_output": "Code looks good",
        }

        create_resp = client.post("/api/v1/workflows/", json=sample_workflow_payload)
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        exec_resp = client.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json={"input_task": "Write a hello world function"},
        )
        assert exec_resp.status_code == 200
        data = exec_resp.json()
        assert data["workflow_id"] == workflow_id
        assert data["status"] == "completed"
        assert data["error"] is None

    def test_execute_workflow_not_found(self, client):
        """POST /api/v1/workflows/{workflow_id}/execute returns 404 for unknown workflow."""
        response = client.post(
            "/api/v1/workflows/nonexistent/execute",
            json={"input_task": "Do something"},
        )
        assert response.status_code == 404

    def test_execute_workflow_missing_task_fails(self, client, sample_workflow_payload):
        """POST /api/v1/workflows/{workflow_id}/execute without input_task returns 422."""
        create_resp = client.post("/api/v1/workflows/", json=sample_workflow_payload)
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        exec_resp = client.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json={},
        )
        assert exec_resp.status_code == 422


# ============================================================
# Custom DAG Workflow Tests
# ============================================================


class TestCustomDAGWorkflow:
    """Tests for custom DAG workflow creation and execution."""

    def test_create_custom_dag_workflow(self, client):
        """POST /api/v1/workflows/ creates a workflow with custom DAG structure."""
        payload = {
            "name": "custom-dag-workflow",
            "description": "A custom DAG with multiple paths",
            "nodes": [
                {"id": "coder-1", "agent_type": "coder", "name": "Feature Coder"},
                {"id": "coder-2", "agent_type": "coder", "name": "Test Coder"},
                {"id": "reviewer-1", "agent_type": "reviewer", "name": "Reviewer"},
                {"id": "tester-1", "agent_type": "tester", "name": "Tester"},
            ],
            "edges": [
                {"source": "coder-1", "target": "reviewer-1"},
                {"source": "coder-2", "target": "reviewer-1"},
                {"source": "reviewer-1", "target": "tester-1"},
            ],
        }
        response = client.post("/api/v1/workflows/", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert len(data["nodes"]) == 4
        assert len(data["edges"]) == 3

    def test_create_workflow_with_conditional_edges(self, client):
        """POST /api/v1/workflows/ creates a workflow with conditional edges."""
        payload = {
            "name": "conditional-workflow",
            "description": "Workflow with conditional routing",
            "nodes": [
                {"id": "coder-node", "agent_type": "coder", "name": "Coder"},
                {"id": "reviewer-node", "agent_type": "reviewer", "name": "Reviewer"},
                {"id": "tester-node", "agent_type": "tester", "name": "Tester"},
            ],
            "edges": [
                {
                    "source": "coder-node",
                    "target": "reviewer-node",
                    "condition": "needs_review",
                },
                {
                    "source": "reviewer-node",
                    "target": "tester-node",
                },
            ],
        }
        response = client.post("/api/v1/workflows/", json=payload)
        assert response.status_code == 201
        data = response.json()
        # Verify conditional edge is stored
        conditional_edges = [e for e in data["edges"] if e.get("condition")]
        assert len(conditional_edges) == 1

    @patch("app.graph.workflow.WorkflowEngine.run_custom", new_callable=AsyncMock)
    def test_execute_custom_dag_workflow(self, mock_run_custom, client):
        """Execute a custom DAG workflow and verify the engine receives the DAG."""
        mock_run_custom.return_value = {
            "status": "completed",
            "code_output": "Implemented feature",
            "review_output": "Approved",
        }

        payload = {
            "name": "exec-dag-workflow",
            "description": "Custom DAG to execute",
            "nodes": [
                {"id": "coder-1", "agent_type": "coder", "name": "Coder"},
                {"id": "reviewer-1", "agent_type": "reviewer", "name": "Reviewer"},
            ],
            "edges": [
                {"source": "coder-1", "target": "reviewer-1"},
            ],
        }
        create_resp = client.post("/api/v1/workflows/", json=payload)
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        exec_resp = client.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json={
                "input_task": "Implement and review a feature",
                "context": {"project_id": "test-project"},
            },
        )
        assert exec_resp.status_code == 200
        data = exec_resp.json()
        assert data["status"] == "completed"

        # Verify the engine was called with the custom DAG
        mock_run_custom.assert_called_once()
        call_kwargs = mock_run_custom.call_args
        workflow_def = call_kwargs.kwargs.get("workflow_def") or call_kwargs[1].get("workflow_def")
        if workflow_def is None and len(call_kwargs.args) > 0:
            workflow_def = call_kwargs.args[0]
        assert workflow_def is not None
        assert "nodes" in workflow_def
        assert "edges" in workflow_def


# ============================================================
# Full Lifecycle Integration Test
# ============================================================


class TestFullLifecycle:
    """End-to-end lifecycle test: create agent -> chat -> get state -> delete."""

    @patch("app.agents.base.BaseAgent.run", new_callable=AsyncMock)
    def test_agent_full_lifecycle(self, mock_run, client):
        """Test the complete agent lifecycle from creation to deletion."""
        mock_run.return_value = "I've implemented the feature as requested."

        # Step 1: Create agent
        create_resp = client.post(
            "/api/v1/agents/",
            json={
                "name": "lifecycle-agent",
                "agent_type": "coder",
                "description": "Agent for full lifecycle test",
            },
        )
        assert create_resp.status_code == 201
        agent_id = create_resp.json()["id"]

        # Step 2: Chat with agent
        chat_resp = client.post(
            f"/api/v1/agents/{agent_id}/chat",
            json={"message": "Implement a feature"},
        )
        assert chat_resp.status_code == 200
        assert chat_resp.json()["message"]["role"] == "assistant"

        # Step 3: Get thinking chain
        tc_resp = client.get(f"/api/v1/agents/{agent_id}/thinking-chain")
        assert tc_resp.status_code == 200
        assert tc_resp.json()["agent_id"] == agent_id

        # Step 4: Get messages
        msg_resp = client.get(f"/api/v1/agents/{agent_id}/messages")
        assert msg_resp.status_code == 200
        messages = msg_resp.json()
        assert len(messages) >= 2  # user + assistant

        # Step 5: Get agent state
        state_resp = client.get(f"/api/v1/agents/{agent_id}")
        assert state_resp.status_code == 200
        assert state_resp.json()["id"] == agent_id

        # Step 6: Delete agent
        delete_resp = client.delete(f"/api/v1/agents/{agent_id}")
        assert delete_resp.status_code == 204

        # Step 7: Verify deletion
        get_resp = client.get(f"/api/v1/agents/{agent_id}")
        assert get_resp.status_code == 404

    @patch("app.graph.workflow.WorkflowEngine.run_custom", new_callable=AsyncMock)
    def test_workflow_full_lifecycle(self, mock_run_custom, client):
        """Test the complete workflow lifecycle from creation to deletion."""
        mock_run_custom.return_value = {
            "status": "completed",
            "code_output": "Feature implemented",
        }

        # Step 1: Create workflow
        create_resp = client.post(
            "/api/v1/workflows/",
            json={
                "name": "lifecycle-workflow",
                "description": "Workflow for full lifecycle test",
                "nodes": [
                    {"id": "coder-1", "agent_type": "coder", "name": "Coder"},
                    {"id": "reviewer-1", "agent_type": "reviewer", "name": "Reviewer"},
                ],
                "edges": [
                    {"source": "coder-1", "target": "reviewer-1"},
                ],
            },
        )
        assert create_resp.status_code == 201
        workflow_id = create_resp.json()["id"]

        # Step 2: Get workflow
        get_resp = client.get(f"/api/v1/workflows/{workflow_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "created"

        # Step 3: Execute workflow
        exec_resp = client.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json={"input_task": "Implement a feature"},
        )
        assert exec_resp.status_code == 200
        assert exec_resp.json()["status"] == "completed"

        # Step 4: List workflows (should contain our workflow)
        list_resp = client.get("/api/v1/workflows/")
        assert list_resp.status_code == 200
        assert any(wf["id"] == workflow_id for wf in list_resp.json())

        # Step 5: Delete workflow
        delete_resp = client.delete(f"/api/v1/workflows/{workflow_id}")
        assert delete_resp.status_code == 204

        # Step 6: Verify deletion
        get_resp2 = client.get(f"/api/v1/workflows/{workflow_id}")
        assert get_resp2.status_code == 404
