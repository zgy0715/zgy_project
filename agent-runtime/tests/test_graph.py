"""Tests for the LangGraph workflow engine."""

import pytest

from app.graph.state import WorkflowState, create_initial_state
from app.graph.edges import (
    route_after_coder,
    route_after_reviewer,
    route_after_tester,
    should_continue,
)


class TestWorkflowState:
    """Tests for the WorkflowState TypedDict."""

    def test_create_initial_state(self) -> None:
        """Test creating an initial workflow state."""
        state = create_initial_state("Implement a feature")
        assert state["task"] == "Implement a feature"
        assert state["status"] == "pending"
        assert state["iteration"] == 0
        assert state["messages"] == []
        assert state["errors"] == []

    def test_create_initial_state_with_context(self) -> None:
        """Test creating an initial state with context."""
        context = {"project_id": "test-123", "language": "python"}
        state = create_initial_state("Task", context)
        assert state["context"] == context

    def test_create_initial_state_default_context(self) -> None:
        """Test that default context is an empty dict."""
        state = create_initial_state("Task")
        assert state["context"] == {}


class TestConditionalEdges:
    """Tests for conditional edge routing functions."""

    def test_route_after_coder_with_output(self) -> None:
        """Test routing after coder when code output exists."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "coder",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Generated code",
            "review_output": "",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_coder(state)
        assert result == "reviewer"

    def test_route_after_coder_no_output(self) -> None:
        """Test routing after coder when no code output."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "coder",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "",
            "review_output": "",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_coder(state)
        assert result == "coder"

    def test_route_after_coder_max_iterations(self) -> None:
        """Test routing to end when max iterations reached."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "coder",
            "iteration": 3,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": ["Error occurred"],
        }
        result = route_after_coder(state)
        assert result == "end"

    def test_route_after_reviewer_pass(self) -> None:
        """Test routing after reviewer when review passes."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "reviewer",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "Code looks good, no issues found.",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_reviewer(state)
        assert result == "tester"

    def test_route_after_reviewer_needs_changes(self) -> None:
        """Test routing back to coder when review finds critical issues."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "reviewer",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "Found critical error in the implementation.",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_reviewer(state)
        assert result == "coder"

    def test_route_after_tester_pass(self) -> None:
        """Test routing after tester when tests pass."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "tester",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "Review passed",
            "test_output": "All tests passed successfully.",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_tester(state)
        assert result == "deployer"

    def test_route_after_tester_fail(self) -> None:
        """Test routing back to coder when tests fail."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "tester",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "Review passed",
            "test_output": "Tests fail: assertion error in test_func",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_tester(state)
        assert result == "coder"

    def test_should_continue_under_limit(self) -> None:
        """Test should_continue when under iteration limit."""
        state: WorkflowState = {
            "task": "Test",
            "context": {},
            "current_agent": "",
            "iteration": 1,
            "max_iterations": 3,
            "status": "running",
            "plan": "",
            "code_output": "",
            "review_output": "",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        assert should_continue(state) == "continue"

    def test_should_continue_at_limit(self) -> None:
        """Test should_continue when at iteration limit."""
        state: WorkflowState = {
            "task": "Test",
            "context": {},
            "current_agent": "",
            "iteration": 3,
            "max_iterations": 3,
            "status": "running",
            "plan": "",
            "code_output": "",
            "review_output": "",
            "test_output": "",
            "deploy_output": "",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        assert should_continue(state) == "end"
