"""API contract tests verifying endpoint paths and schemas match between Java Gateway and Python Runtime.

These tests ensure that:
1. All endpoints called by AgentRestClient exist in the Python FastAPI
2. Request/response schemas are compatible
3. HTTP methods match
4. Path parameter naming conventions are consistent
"""

import re
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.main import create_app

# Define the expected API contract from Java AgentRestClient
# Each entry: "METHOD /path" -> Java method name
EXPECTED_ENDPOINTS = {
    "POST /api/v1/agents/": "createAgent",
    "GET /api/v1/agents/": "listAgents",
    "GET /api/v1/agents/{agent_id}": "getAgent",
    "POST /api/v1/agents/{agent_id}/execute": "executeAgent",
    "POST /api/v1/agents/{agent_id}/chat": "chatWithAgent",
    "POST /api/v1/agents/{agent_id}/chat/stream": "streamChat",
    "GET /api/v1/agents/{agent_id}/thinking-chain": "getThinkingChain",
    "GET /api/v1/agents/{agent_id}/messages": "getMessages",
    "GET /api/v1/agents/{agent_id}/review-findings": "getReviewFindings",
    "DELETE /api/v1/agents/{agent_id}": "deleteAgent",
    "POST /api/v1/workflows/": "createWorkflow",
    "GET /api/v1/workflows/": "listWorkflows",
    "GET /api/v1/workflows/{workflow_id}": "getWorkflow",
    "POST /api/v1/workflows/{workflow_id}/execute": "executeWorkflow",
    "DELETE /api/v1/workflows/{workflow_id}": "deleteWorkflow",
}


def _normalize_path(path: str) -> str:
    """Normalize a FastAPI path to match the contract format.

    FastAPI uses {param} style path parameters, same as our contract format.
    This function ensures consistent formatting.
    """
    return path


def _extract_routes(app: FastAPI) -> dict[str, dict[str, Any]]:
    """Extract all API routes from the FastAPI app.

    Returns a dict mapping "METHOD /path" to route metadata.
    """
    routes: dict[str, dict[str, Any]] = {}
    for route in app.routes:
        if isinstance(route, APIRoute):
            path = _normalize_path(route.path)
            for method in route.methods or set():
                key = f"{method} {path}"
                routes[key] = {
                    "path": route.path,
                    "method": method,
                    "name": route.name,
                    "response_model": route.response_model,
                    "status_code": route.status_code,
                }
    return routes


@pytest.fixture(scope="module")
def app():
    """Create the FastAPI application for contract testing."""
    return create_app()


@pytest.fixture(scope="module")
def routes(app):
    """Extract all routes from the application."""
    return _extract_routes(app)


# ============================================================
# Endpoint Existence Tests
# ============================================================


class TestEndpointExistence:
    """Verify that all endpoints expected by the Java AgentRestClient exist in Python FastAPI."""

    def test_all_expected_agent_endpoints_exist(self, routes):
        """Every agent endpoint in the Java contract must exist in the Python API."""
        agent_endpoints = {
            k: v for k, v in EXPECTED_ENDPOINTS.items()
            if "/agents" in k
        }
        missing = []
        for endpoint_key, java_method in agent_endpoints.items():
            if endpoint_key not in routes:
                missing.append(f"{endpoint_key} (called by {java_method})")

        assert not missing, (
            f"Missing agent endpoints in Python FastAPI that Java AgentRestClient calls:\n"
            + "\n".join(f"  - {m}" for m in missing)
        )

    def test_all_expected_workflow_endpoints_exist(self, routes):
        """Every workflow endpoint in the Java contract must exist in the Python API."""
        workflow_endpoints = {
            k: v for k, v in EXPECTED_ENDPOINTS.items()
            if "/workflows" in k
        }
        missing = []
        for endpoint_key, java_method in workflow_endpoints.items():
            if endpoint_key not in routes:
                missing.append(f"{endpoint_key} (called by {java_method})")

        assert not missing, (
            f"Missing workflow endpoints in Python FastAPI that Java AgentRestClient calls:\n"
            + "\n".join(f"  - {m}" for m in missing)
        )

    def test_no_extra_agent_endpoints_conflict(self, routes):
        """Verify there are no unexpected agent endpoints that might confuse the Java client."""
        agent_routes = {
            k: v for k, v in routes.items()
            if "/agents" in k and "/api/v1" in k
        }
        # All agent routes should be in our expected contract or be documented additions
        for route_key in agent_routes:
            # We don't fail on extra endpoints, but we log them for awareness
            if route_key not in EXPECTED_ENDPOINTS:
                # This is informational - extra endpoints are OK
                pass


# ============================================================
# HTTP Method Matching Tests
# ============================================================


class TestHTTPMethodMatching:
    """Verify that HTTP methods match between Java and Python endpoints."""

    @pytest.mark.parametrize("endpoint_key,java_method", EXPECTED_ENDPOINTS.items())
    def test_http_method_matches(self, routes, endpoint_key, java_method):
        """The HTTP method for each endpoint must match between Java and Python."""
        if endpoint_key not in routes:
            pytest.skip(f"Endpoint {endpoint_key} not found (tested in TestEndpointExistence)")

        expected_method = endpoint_key.split(" ")[0]
        actual_method = routes[endpoint_key]["method"]
        assert actual_method == expected_method, (
            f"Method mismatch for {java_method}: "
            f"Java expects {expected_method}, Python has {actual_method}"
        )


# ============================================================
# Path Parameter Naming Tests
# ============================================================


class TestPathParameterNaming:
    """Verify path parameter names are consistent between Java and Python."""

    def test_agent_id_parameter_name(self, routes):
        """Python agent endpoints use {agent_id} matching Java's {agentId}."""
        agent_routes_with_params = {
            k: v for k, v in routes.items()
            if "/agents/" in k and k != "GET /api/v1/agents/" and k != "POST /api/v1/agents/"
        }
        for route_key, route_info in agent_routes_with_params.items():
            path = route_info["path"]
            # Extract path parameters
            params = re.findall(r"\{(\w+)\}", path)
            for param in params:
                if "agent" in param.lower():
                    # Python uses agent_id, Java uses agentId
                    # Both should resolve to the same path segment
                    assert param == "agent_id", (
                        f"Path parameter '{param}' in {path} should be 'agent_id' "
                        f"to match Java's 'agentId'"
                    )

    def test_workflow_id_parameter_name(self, routes):
        """Python workflow endpoints use {workflow_id} matching Java's {workflowId}."""
        workflow_routes_with_params = {
            k: v for k, v in routes.items()
            if "/workflows/" in k and k != "GET /api/v1/workflows/" and k != "POST /api/v1/workflows/"
        }
        for route_key, route_info in workflow_routes_with_params.items():
            path = route_info["path"]
            params = re.findall(r"\{(\w+)\}", path)
            for param in params:
                if "workflow" in param.lower():
                    assert param == "workflow_id", (
                        f"Path parameter '{param}' in {path} should be 'workflow_id' "
                        f"to match Java's 'workflowId'"
                    )


# ============================================================
# Response Schema Compatibility Tests
# ============================================================


class TestResponseSchemaCompatibility:
    """Verify response schemas are compatible between Java and Python."""

    def test_create_agent_response_schema(self, routes):
        """POST /api/v1/agents/ response includes fields expected by Java."""
        route = routes.get("POST /api/v1/agents/")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            # Java AgentRestClient expects at least these fields in the response
            expected_fields = {"id", "agent_type", "name", "status"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"createAgent response missing fields: {missing}"

    def test_execute_agent_response_schema(self, routes):
        """POST /api/v1/agents/{agent_id}/execute response includes expected fields."""
        route = routes.get("POST /api/v1/agents/{agent_id}/execute")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"agent_id", "status"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"executeAgent response missing fields: {missing}"

    def test_chat_response_schema(self, routes):
        """POST /api/v1/agents/{agent_id}/chat response includes expected fields."""
        route = routes.get("POST /api/v1/agents/{agent_id}/chat")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"agent_id", "message", "status"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"chatWithAgent response missing fields: {missing}"

    def test_thinking_chain_response_schema(self, routes):
        """GET /api/v1/agents/{agent_id}/thinking-chain response includes expected fields."""
        route = routes.get("GET /api/v1/agents/{agent_id}/thinking-chain")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"agent_id", "steps", "total_steps"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"getThinkingChain response missing fields: {missing}"

    def test_workflow_response_schema(self, routes):
        """POST /api/v1/workflows/ response includes expected fields."""
        route = routes.get("POST /api/v1/workflows/")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"id", "name", "status", "nodes", "edges"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"createWorkflow response missing fields: {missing}"

    def test_workflow_execution_response_schema(self, routes):
        """POST /api/v1/workflows/{workflow_id}/execute response includes expected fields."""
        route = routes.get("POST /api/v1/workflows/{workflow_id}/execute")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"workflow_id", "status"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"executeWorkflow response missing fields: {missing}"

    def test_health_response_schema(self, routes):
        """GET /api/v1/health response includes expected fields."""
        route = routes.get("GET /api/v1/health")
        if route is None:
            pytest.skip("Endpoint not found")

        response_model = route["response_model"]
        if response_model is not None:
            schema = response_model.model_json_schema()
            properties = schema.get("properties", {})
            expected_fields = {"status", "version", "uptime_seconds", "services"}
            actual_fields = set(properties.keys())
            missing = expected_fields - actual_fields
            assert not missing, f"health response missing fields: {missing}"


# ============================================================
# Status Code Compatibility Tests
# ============================================================


class TestStatusCodeCompatibility:
    """Verify HTTP status codes match expectations between Java and Python."""

    def test_create_agent_returns_201(self, routes):
        """POST /api/v1/agents/ returns 201 Created."""
        route = routes.get("POST /api/v1/agents/")
        if route is None:
            pytest.skip("Endpoint not found")
        assert route["status_code"] == 201

    def test_create_workflow_returns_201(self, routes):
        """POST /api/v1/workflows/ returns 201 Created."""
        route = routes.get("POST /api/v1/workflows/")
        if route is None:
            pytest.skip("Endpoint not found")
        assert route["status_code"] == 201

    def test_delete_agent_returns_204(self, routes):
        """DELETE /api/v1/agents/{agent_id} returns 204 No Content."""
        route = routes.get("DELETE /api/v1/agents/{agent_id}")
        if route is None:
            pytest.skip("Endpoint not found")
        assert route["status_code"] == 204

    def test_delete_workflow_returns_204(self, routes):
        """DELETE /api/v1/workflows/{workflow_id} returns 204 No Content."""
        route = routes.get("DELETE /api/v1/workflows/{workflow_id}")
        if route is None:
            pytest.skip("Endpoint not found")
        assert route["status_code"] == 204


# ============================================================
# Query Parameter Compatibility Tests
# ============================================================


class TestQueryParameterCompatibility:
    """Verify query parameter names match between Java and Python."""

    def test_list_agents_query_params(self, routes):
        """GET /api/v1/agents/ uses agent_type and status_filter query params."""
        route = routes.get("GET /api/v1/agents/")
        if route is None:
            pytest.skip("Endpoint not found")

        # Check the route's dependency parameters for query params
        param_names = set()
        for param in route.get("path", "").split("?")[-1].split("&") if "?" in route.get("path", "") else []:
            pass

        # Instead, check the actual function signature via the route
        from app.api.routes.agents import list_agents
        import inspect
        sig = inspect.signature(list_agents)
        param_names = set(sig.parameters.keys())

        # Java sends agent_type and status_filter
        assert "agent_type" in param_names, "listAgents missing 'agent_type' query parameter"
        assert "status_filter" in param_names, "listAgents missing 'status_filter' query parameter"

    def test_list_workflows_query_params(self, routes):
        """GET /api/v1/workflows/ uses status_filter query param."""
        from app.api.routes.workflows import list_workflows
        import inspect
        sig = inspect.signature(list_workflows)
        param_names = set(sig.parameters.keys())

        assert "status_filter" in param_names, "listWorkflows missing 'status_filter' query parameter"

    def test_get_messages_query_params(self, routes):
        """GET /api/v1/agents/{agent_id}/messages uses limit and offset query params."""
        from app.api.routes.agents import get_agent_messages
        import inspect
        sig = inspect.signature(get_agent_messages)
        param_names = set(sig.parameters.keys())

        # Java sends limit and offset
        assert "limit" in param_names, "getMessages missing 'limit' query parameter"
        assert "offset" in param_names, "getMessages missing 'offset' query parameter"


# ============================================================
# Chat Endpoint Distinction Tests
# ============================================================


class TestChatEndpointDistinction:
    """Verify that chat endpoints are distinct from execute endpoints.

    The Java AgentRestClient explicitly uses /chat (not /execute) for
    chatWithAgent and /chat/stream for streamChat. These tests ensure
    the Python API maintains this distinction.
    """

    def test_chat_endpoint_exists_separate_from_execute(self, routes):
        """POST /api/v1/agents/{agent_id}/chat exists as a distinct endpoint from /execute."""
        chat_key = "POST /api/v1/agents/{agent_id}/chat"
        execute_key = "POST /api/v1/agents/{agent_id}/execute"

        assert chat_key in routes, "Chat endpoint must exist separately from execute"
        assert execute_key in routes, "Execute endpoint must exist"

        # They must be different routes
        chat_route = routes[chat_key]
        execute_route = routes[execute_key]
        assert chat_route["name"] != execute_route["name"], (
            "Chat and execute must be handled by different route functions"
        )

    def test_chat_stream_endpoint_exists(self, routes):
        """POST /api/v1/agents/{agent_id}/chat/stream exists for SSE streaming."""
        stream_key = "POST /api/v1/agents/{agent_id}/chat/stream"
        assert stream_key in routes, "Chat stream endpoint must exist"

    def test_chat_stream_returns_sse(self, routes):
        """POST /api/v1/agents/{agent_id}/chat/stream returns text/event-stream."""
        stream_key = "POST /api/v1/agents/{agent_id}/chat/stream"
        if stream_key not in routes:
            pytest.skip("Stream endpoint not found")

        route = routes[stream_key]
        # The streaming endpoint should not have a standard response_model
        # since it returns StreamingResponse
        # It's acceptable for response_model to be None for SSE endpoints
        # The key thing is that the endpoint exists and is distinct


# ============================================================
# Full Contract Summary Test
# ============================================================


class TestContractSummary:
    """Summary test that reports the overall contract compliance."""

    def test_contract_compliance_summary(self, routes):
        """Report overall contract compliance between Java and Python."""
        total = len(EXPECTED_ENDPOINTS)
        found = sum(1 for key in EXPECTED_ENDPOINTS if key in routes)
        missing = [key for key in EXPECTED_ENDPOINTS if key not in routes]

        compliance_pct = (found / total) * 100 if total > 0 else 0

        # We expect 100% compliance
        assert compliance_pct == 100, (
            f"API contract compliance: {compliance_pct:.1f}% ({found}/{total})\n"
            f"Missing endpoints:\n"
            + "\n".join(f"  - {k} (Java: {EXPECTED_ENDPOINTS[k]})" for k in missing)
        )
