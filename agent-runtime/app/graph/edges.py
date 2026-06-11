"""Conditional edge definitions for the LangGraph workflow.

Edges determine the flow between agent nodes based on the
output of the previous node.
"""

import logging

from app.graph.state import WorkflowState

logger = logging.getLogger(__name__)


def route_after_coder(state: WorkflowState) -> str:
    """Determine the next node after the Coder agent completes.

    Routes based on whether code generation was successful and
    whether a review is needed.

    Args:
        state: Current workflow state.

    Returns:
        The name of the next node to execute.
    """
    code_output = state.get("code_output", "")
    errors = state.get("errors", [])
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)

    if errors and iteration >= max_iterations:
        logger.warning("Max iterations reached, routing to end")
        return "end"

    if not code_output:
        logger.info("No code output, routing back to coder for retry")
        return "coder"

    # Default: send code to reviewer
    logger.info("Routing from coder to reviewer")
    return "reviewer"


def route_after_reviewer(state: WorkflowState) -> str:
    """Determine the next node after the Reviewer agent completes.

    Routes based on review feedback: if issues are found,
    route back to coder for fixes; otherwise proceed to tester.

    Args:
        state: Current workflow state.

    Returns:
        The name of the next node to execute.
    """
    review_output = state.get("review_output", "")
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)

    # TODO: Parse review output with LLM to determine if changes are needed
    # For now, use simple heuristic
    needs_changes = "critical" in review_output.lower() or "error" in review_output.lower()

    if needs_changes and iteration < max_iterations:
        logger.info("Review found issues, routing back to coder (iteration %d)", iteration)
        return "coder"

    logger.info("Review passed, routing to tester")
    return "tester"


def route_after_tester(state: WorkflowState) -> str:
    """Determine the next node after the Tester agent completes.

    Routes based on test results: if tests pass, proceed to
    deployer; if tests fail, route back to coder.

    Args:
        state: Current workflow state.

    Returns:
        The name of the next node to execute.
    """
    test_output = state.get("test_output", "")
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)

    # TODO: Parse test output to determine if tests passed
    tests_passed = "fail" not in test_output.lower()

    if not tests_passed and iteration < max_iterations:
        logger.info("Tests failed, routing back to coder (iteration %d)", iteration)
        return "coder"

    if tests_passed:
        logger.info("Tests passed, routing to deployer")
        return "deployer"

    logger.warning("Max iterations reached, routing to end")
    return "end"


def should_continue(state: WorkflowState) -> str:
    """General-purpose conditional edge for loop control.

    Checks if the workflow should continue or terminate
    based on iteration count and error state.

    Args:
        state: Current workflow state.

    Returns:
        "continue" or "end" based on the state.
    """
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)
    errors = state.get("errors", [])

    if iteration >= max_iterations:
        logger.warning("Max iterations (%d) reached, ending workflow", max_iterations)
        return "end"

    if errors and len(errors) > 5:
        logger.error("Too many errors (%d), ending workflow", len(errors))
        return "end"

    return "continue"
