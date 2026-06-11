"""Reviewer Agent implementation - responsible for code review."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType

logger = logging.getLogger(__name__)

REVIEWER_SYSTEM_PROMPT = """You are a Reviewer Agent in the DeepAgent system.
Your primary responsibility is to review code for quality, correctness, and best practices.

Key responsibilities:
- Review code changes for correctness and potential bugs
- Check adherence to coding standards and best practices
- Identify security vulnerabilities
- Suggest improvements and optimizations
- Verify that code meets the task requirements

Review criteria:
- Code correctness and logic errors
- Error handling completeness
- Type hint coverage
- Documentation quality
- Security considerations
- Performance implications
- Test coverage suggestions
"""


class ReviewerAgent(BaseAgent):
    """Agent responsible for code review tasks.

    The Reviewer Agent analyzes code changes and provides structured
    feedback on quality, correctness, security, and best practices.

    Attributes:
        agent_type: Always AgentType.REVIEWER.
    """

    @property
    def agent_type(self) -> AgentType:
        """Return the reviewer agent type."""
        return AgentType.REVIEWER

    async def plan(self, task: str, context: dict[str, Any]) -> str:
        """Create a code review plan.

        Determines the scope of the review, which aspects to focus on,
        and what standards to apply.

        Args:
            task: The review task description (e.g., code diff to review).
            context: Additional context (original code, requirements, etc.).

        Returns:
            A plan describing the review approach.
        """
        logger.info("ReviewerAgent '%s' planning review: %s", self.name, task)

        # TODO: Integrate with LLM service for plan generation
        plan = (
            f"Code review plan for: {task}\n"
            f"1. Analyze the code diff and changes\n"
            f"2. Check for correctness and logic errors\n"
            f"3. Review error handling and edge cases\n"
            f"4. Assess security implications\n"
            f"5. Evaluate code style and conventions\n"
            f"6. Suggest improvements"
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code review plan.

        Analyzes the code using available tools and generates
        structured review feedback.

        Args:
            plan: The review plan.
            context: Additional context for the review.

        Returns:
            The raw review findings.
        """
        logger.info("ReviewerAgent '%s' executing review plan", self.name)

        # TODO: Integrate with LLM service and tools for actual review
        execution_result = (
            f"Executed code review plan:\n{plan}\n\n"
            f"Review findings (placeholder):\n"
            f"- No critical issues found\n"
            f"- Minor style suggestions available"
        )

        self.artifacts.append({
            "type": "code_review",
            "plan": plan,
            "status": "completed",
        })

        return execution_result

    async def reflect(self, execution_result: str) -> str:
        """Reflect on review findings for completeness.

        Ensures the review covered all important aspects and
        that feedback is actionable and constructive.

        Args:
            execution_result: The raw review findings.

        Returns:
            Refined review feedback.
        """
        logger.info("ReviewerAgent '%s' reflecting on review", self.name)

        # TODO: Integrate with LLM service for review reflection
        reflection = (
            f"Refined code review:\n{execution_result}\n\n"
            f"Review completeness verified (placeholder)."
        )

        return reflection
