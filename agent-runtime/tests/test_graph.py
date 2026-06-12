"""Tests for the LangGraph workflow engine."""

import pytest

from app.graph.state import WorkflowState, create_initial_state
from app.graph.edges import (
    route_after_coder,
    route_after_reviewer,
    route_after_tester,
    route_after_deployer,
    should_continue,
    _parse_review_severity,
    _parse_test_results,
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

    def test_create_initial_state_new_fields(self) -> None:
        """Test that new structured analysis fields are initialized."""
        state = create_initial_state("Task")
        assert state["thinking_steps"] == []
        assert state["review_findings"] == []
        assert state["test_results"] == {}


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

    @pytest.mark.asyncio
    async def test_route_after_reviewer_pass(self) -> None:
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
        result = await route_after_reviewer(state)
        assert result == "tester"

    @pytest.mark.asyncio
    async def test_route_after_reviewer_needs_changes(self) -> None:
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
        result = await route_after_reviewer(state)
        assert result == "coder"

    @pytest.mark.asyncio
    async def test_route_after_tester_pass(self) -> None:
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
        result = await route_after_tester(state)
        assert result == "deployer"

    @pytest.mark.asyncio
    async def test_route_after_tester_fail(self) -> None:
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
        result = await route_after_tester(state)
        assert result == "coder"

    def test_route_after_deployer(self) -> None:
        """Test that deployer always routes to end."""
        state: WorkflowState = {
            "task": "Test task",
            "context": {},
            "current_agent": "deployer",
            "iteration": 0,
            "max_iterations": 3,
            "status": "executing",
            "plan": "Plan",
            "code_output": "Code",
            "review_output": "",
            "test_output": "",
            "deploy_output": "Deployed successfully",
            "messages": [],
            "artifacts": [],
            "errors": [],
        }
        result = route_after_deployer(state)
        assert result == "end"

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


class TestStructuredParsing:
    """Tests for structured output parsing helpers."""

    def test_parse_review_severity_critical(self) -> None:
        """Test parsing critical severity from markdown header."""
        result = _parse_review_severity("## Severity: CRITICAL\n\nMajor issues found.")
        assert result == "needs_changes"

    def test_parse_review_severity_error(self) -> None:
        """Test parsing error severity from markdown header."""
        result = _parse_review_severity("## Severity: ERROR\n\nBug detected.")
        assert result == "needs_changes"

    def test_parse_review_severity_warning(self) -> None:
        """Test parsing warning severity from markdown header."""
        result = _parse_review_severity("## Severity: WARNING\n\nMinor style issues.")
        assert result == "approved"

    def test_parse_review_severity_approved_marker(self) -> None:
        """Test parsing APPROVED status marker."""
        result = _parse_review_severity("Code review: APPROVED")
        assert result == "approved"

    def test_parse_review_severity_needs_changes_marker(self) -> None:
        """Test parsing NEEDS_CHANGES status marker."""
        result = _parse_review_severity("Code review: NEEDS_CHANGES")
        assert result == "needs_changes"

    def test_parse_review_severity_json_block(self) -> None:
        """Test parsing severity from JSON block."""
        result = _parse_review_severity('```json\n{"severity": "CRITICAL", "issues": 3}\n```')
        assert result == "needs_changes"

    def test_parse_review_severity_json_status(self) -> None:
        """Test parsing status from JSON block."""
        result = _parse_review_severity('```json\n{"status": "APPROVED"}\n```')
        assert result == "approved"

    def test_parse_review_severity_empty(self) -> None:
        """Test parsing empty review output."""
        assert _parse_review_severity("") == ""
        assert _parse_review_severity("No structured markers here") == ""

    def test_parse_test_results_passed(self) -> None:
        """Test parsing PASSED marker."""
        result = _parse_test_results("All tests PASSED")
        assert result == "passed"

    def test_parse_test_results_failed(self) -> None:
        """Test parsing FAILED marker."""
        result = _parse_test_results("Test FAILED: assertion error")
        assert result == "failed"

    def test_parse_test_results_exit_code_zero(self) -> None:
        """Test parsing exit code 0."""
        result = _parse_test_results("Tests completed. Exit code: 0")
        assert result == "passed"

    def test_parse_test_results_exit_code_nonzero(self) -> None:
        """Test parsing non-zero exit code."""
        result = _parse_test_results("Tests completed. Exit code: 1")
        assert result == "failed"

    def test_parse_test_results_count_summary(self) -> None:
        """Test parsing test count summary."""
        assert _parse_test_results("3 passed, 0 failed") == "passed"
        assert _parse_test_results("3 passed, 1 failed") == "failed"

    def test_parse_test_results_json_block(self) -> None:
        """Test parsing test results from JSON block."""
        result = _parse_test_results('```json\n{"passed": 5, "failed": 0}\n```')
        assert result == "passed"

    def test_parse_test_results_json_failures(self) -> None:
        """Test parsing test failures from JSON block."""
        result = _parse_test_results('```json\n{"passed": 3, "failed": 2}\n```')
        assert result == "failed"

    def test_parse_test_results_empty(self) -> None:
        """Test parsing empty test output."""
        assert _parse_test_results("") == ""
        assert _parse_test_results("No structured results here") == ""
