"""Reviewer Agent implementation - responsible for code review."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message

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
        """Create a code review plan using the LLM.

        Determines the scope of the review, which aspects to focus on,
        and what standards to apply.

        Args:
            task: The review task description (e.g., code diff to review).
            context: Additional context (original code, requirements, etc.).

        Returns:
            A plan describing the review approach.
        """
        logger.info("ReviewerAgent '%s' planning review: %s", self.name, task)

        messages = [
            Message(role=MessageRole.SYSTEM, content=REVIEWER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Create a structured code review plan for the following task.\n\n"
                f"Task: {task}\n"
                f"Context: {context}\n\n"
                f"Outline the review scope covering:\n"
                f"1. Correctness and logic\n"
                f"2. Error handling\n"
                f"3. Security implications\n"
                f"4. Code style and conventions\n"
                f"5. Performance considerations"
            )),
        ]

        plan = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code review plan using the LLM.

        Analyzes the code using available tools and generates
        structured review feedback.

        Args:
            plan: The review plan.
            context: Additional context for the review.

        Returns:
            The structured review findings.
        """
        logger.info("ReviewerAgent '%s' executing review plan", self.name)

        # Extract the code from context or task
        code_to_review = context.get("code", "")
        if not code_to_review and "review" in plan.lower():
            # Try to extract code from the task description
            code_to_review = plan

        messages = [
            Message(role=MessageRole.SYSTEM, content=REVIEWER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Review the following code thoroughly.\n\n"
                f"Plan context: {plan}\n"
                f"{'Code to review:\n' + code_to_review if code_to_review else ''}\n"
                f"Context: {context}\n\n"
                f"Provide structured feedback:\n"
                f"## Issues Found\n"
                f"- Critical: ...\n"
                f"- Warning: ...\n"
                f"- Suggestion: ...\n\n"
                f"## Summary\n"
                f"Overall assessment and recommended actions."
            )),
        ]

        review = await self.llm.complete(
            messages=messages,
            temperature=0.2,
            max_tokens=4096,
        )

        self.artifacts.append({
            "type": "code_review",
            "plan": plan,
            "status": "completed",
            "review_length": len(review),
        })

        return review

    async def reflect(self, execution_result: str) -> str:
        """Reflect on review findings for completeness using the LLM.

        Ensures the review covered all important aspects and
        that feedback is actionable and constructive.

        Args:
            execution_result: The raw review findings.

        Returns:
            Refined review feedback.
        """
        logger.info("ReviewerAgent '%s' reflecting on review", self.name)

        messages = [
            Message(role=MessageRole.SYSTEM, content=REVIEWER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Review the following code review output for completeness.\n\n"
                f"Review output:\n{execution_result}\n\n"
                f"Check:\n"
                f"1. Are all critical issues identified?\n"
                f"2. Is feedback actionable and constructive?\n"
                f"3. Are suggestions prioritized appropriately?\n"
                f"4. Refine and improve the review if needed."
            )),
        ]

        reflection = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )

        return reflection
