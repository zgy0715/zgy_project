"""Conditional edge definitions for the LangGraph workflow.

Edges determine the flow between agent nodes based on the
output of the previous node. Supports structured parsing,
LLM-assisted classification, and keyword fallback.
"""

import asyncio
import json
import logging
import re
from typing import Any

from app.graph.state import WorkflowState

logger = logging.getLogger(__name__)

# Timeout for LLM classification calls (seconds)
_LLM_CLASSIFY_TIMEOUT = 10


def _parse_review_severity(review_output: str) -> str:
    """Parse structured review output for severity markers.

    Looks for:
    - Markdown headers like "## Severity: CRITICAL"
    - JSON blocks with a "severity" or "status" field
    - Explicit "APPROVED" / "NEEDS_CHANGES" markers

    Args:
        review_output: The raw review output string.

    Returns:
        "needs_changes" if critical/error severity detected,
        "approved" if approved/no issues,
        "" if no structured marker found.
    """
    if not review_output:
        return ""

    # Check for markdown severity headers
    severity_match = re.search(
        r"##\s*Severity\s*:\s*(CRITICAL|ERROR|WARNING|INFO|LOW)",
        review_output,
        re.IGNORECASE,
    )
    if severity_match:
        level = severity_match.group(1).upper()
        if level in ("CRITICAL", "ERROR"):
            return "needs_changes"
        return "approved"

    # Check for explicit status markers
    if re.search(r"\bAPPROVED\b", review_output, re.IGNORECASE):
        return "approved"
    if re.search(r"\bNEEDS[_\s]CHANGES\b", review_output, re.IGNORECASE):
        return "needs_changes"

    # Check for JSON blocks with severity or status
    json_pattern = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL)
    for match in json_pattern.finditer(review_output):
        try:
            data = json.loads(match.group(1))
            severity = data.get("severity", "").upper()
            status_val = data.get("status", "").upper()
            if severity in ("CRITICAL", "ERROR"):
                return "needs_changes"
            if severity in ("WARNING", "INFO", "LOW"):
                return "approved"
            if status_val == "APPROVED":
                return "approved"
            if status_val in ("NEEDS_CHANGES", "REJECTED"):
                return "needs_changes"
        except (json.JSONDecodeError, AttributeError):
            continue

    return ""


def _parse_test_results(test_output: str) -> str:
    """Parse structured test output for pass/fail indicators.

    Looks for:
    - Exit codes (e.g., "exit code: 1")
    - "PASSED"/"FAILED" markers
    - Test count summaries (e.g., "3 passed, 1 failed")
    - JSON test result blocks

    Args:
        test_output: The raw test output string.

    Returns:
        "passed" if tests passed,
        "failed" if tests failed,
        "" if no structured indicator found.
    """
    if not test_output:
        return ""

    # Check for exit codes first (most specific)
    exit_match = re.search(r"exit\s+code\s*:\s*(\d+)", test_output, re.IGNORECASE)
    if exit_match:
        code = int(exit_match.group(1))
        return "passed" if code == 0 else "failed"

    # Check for test count summaries like "3 passed, 1 failed"
    count_match = re.search(
        r"(\d+)\s+passed(?:\s*,\s*(\d+)\s+failed)?",
        test_output,
        re.IGNORECASE,
    )
    if count_match:
        failed_count = int(count_match.group(2) or 0)
        return "passed" if failed_count == 0 else "failed"

    # Check for JSON test result blocks
    json_pattern = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL)
    for match in json_pattern.finditer(test_output):
        try:
            data = json.loads(match.group(1))
            if isinstance(data, dict):
                passed = data.get("passed", data.get("success", None))
                failed = data.get("failed", data.get("failures", None))
                if failed and int(failed) > 0:
                    return "failed"
                if passed is not None:
                    return "passed"
        except (json.JSONDecodeError, AttributeError, ValueError):
            continue

    # Check for explicit PASSED/FAILED markers (less specific, checked last)
    if re.search(r"\bPASSED\b", test_output, re.IGNORECASE) and not re.search(
        r"\bFAILED\b", test_output, re.IGNORECASE
    ):
        return "passed"
    if re.search(r"\bFAILED\b", test_output, re.IGNORECASE):
        return "failed"

    return ""


async def _llm_classify_output(output: str, classification_type: str) -> str:
    """Use LLM to classify agent output.

    Lazily imports LLMService to avoid circular dependencies.
    Falls back gracefully if LLM is unavailable.

    Args:
        output: The agent output text to classify.
        classification_type: Either "review" or "test".

    Returns:
        Classification result string, or "" if LLM is unavailable.
    """
    try:
        from app.models.schemas import Message, MessageRole

        # Lazy import to avoid circular dependencies
        from app.services.llm_service import LLMService

        if classification_type == "review":
            prompt = (
                "Classify the following code review output. "
                "Reply with exactly one word: 'approved' if the code passes review "
                "and no significant changes are needed, or 'needs_changes' if there "
                "are critical issues or errors that must be fixed.\n\n"
                f"Review output:\n{output[:2000]}"
            )
        else:
            prompt = (
                "Classify the following test output. "
                "Reply with exactly one word: 'passed' if all tests passed, "
                "or 'failed' if any tests failed.\n\n"
                f"Test output:\n{output[:2000]}"
            )

        messages = [
            Message(role=MessageRole.SYSTEM, content="You are a classification assistant. Reply with exactly one word."),
            Message(role=MessageRole.USER, content=prompt),
        ]

        llm = LLMService()
        result = await asyncio.wait_for(
            llm.complete(messages=messages, temperature=0.0, max_tokens=10),
            timeout=_LLM_CLASSIFY_TIMEOUT,
        )

        classification = result.strip().lower()

        if classification_type == "review":
            if "needs_changes" in classification or "critical" in classification or "error" in classification:
                return "needs_changes"
            if "approved" in classification or "pass" in classification:
                return "approved"
        else:
            if "fail" in classification:
                return "failed"
            if "pass" in classification:
                return "passed"

        logger.warning(
            "LLM classification returned unexpected result: %s for type %s",
            classification,
            classification_type,
        )
        return ""

    except asyncio.TimeoutError:
        logger.warning("LLM classification timed out for type: %s", classification_type)
        return ""
    except Exception as e:
        logger.warning("LLM classification failed: %s", str(e))
        return ""


def _increment_iteration(state: WorkflowState) -> dict[str, int]:
    """Return a state update that increments the iteration counter.

    Args:
        state: Current workflow state.

    Returns:
        Dict with updated iteration count.
    """
    return {"iteration": state.get("iteration", 0) + 1}


def route_after_coder(state: WorkflowState) -> str:
    """Determine the next node after the Coder agent completes.

    Routes based on whether code generation was successful and
    whether a review is needed. Increments iteration when routing
    back to coder for retry.

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


async def route_after_reviewer(state: WorkflowState) -> str:
    """Determine the next node after the Reviewer agent completes.

    Uses a three-tier classification strategy:
    1. Parse structured markers in the review output
    2. Use LLM to classify if no structured markers found
    3. Fall back to keyword matching if LLM is unavailable

    Always increments iteration when routing back to coder.

    Args:
        state: Current workflow state.

    Returns:
        The name of the next node to execute.
    """
    review_output = state.get("review_output", "")
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)

    # Tier 1: Try structured parsing
    classification = _parse_review_severity(review_output)

    # Tier 2: Try LLM classification
    if not classification:
        classification = await _llm_classify_output(review_output, "review")

    # Tier 3: Keyword fallback
    if not classification:
        if "critical" in review_output.lower() or "error" in review_output.lower():
            classification = "needs_changes"
        else:
            classification = "approved"
        logger.info("Using keyword fallback for review classification: %s", classification)

    if classification == "needs_changes" and iteration < max_iterations:
        logger.info("Review found issues, routing back to coder (iteration %d)", iteration)
        return "coder"

    logger.info("Review passed, routing to tester")
    return "tester"


async def route_after_tester(state: WorkflowState) -> str:
    """Determine the next node after the Tester agent completes.

    Uses a three-tier classification strategy:
    1. Parse structured test results (exit codes, PASSED/FAILED, counts)
    2. Use LLM to classify if no structured results found
    3. Fall back to keyword matching if LLM is unavailable

    Always increments iteration when routing back to coder.

    Args:
        state: Current workflow state.

    Returns:
        The name of the next node to execute.
    """
    test_output = state.get("test_output", "")
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 3)

    # Tier 1: Try structured parsing
    classification = _parse_test_results(test_output)

    # Tier 2: Try LLM classification
    if not classification:
        classification = await _llm_classify_output(test_output, "test")

    # Tier 3: Keyword fallback
    if not classification:
        if "fail" in test_output.lower():
            classification = "failed"
        else:
            classification = "passed"
        logger.info("Using keyword fallback for test classification: %s", classification)

    if classification == "failed" and iteration < max_iterations:
        logger.info("Tests failed, routing back to coder (iteration %d)", iteration)
        return "coder"

    if classification == "passed":
        logger.info("Tests passed, routing to deployer")
        return "deployer"

    logger.warning("Max iterations reached, routing to end")
    return "end"


def route_after_deployer(state: WorkflowState) -> str:
    """Determine the next node after the Deployer agent completes.

    The deployer is always a terminal node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        Always returns "end".
    """
    logger.info("Deployment complete, routing to end")
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
