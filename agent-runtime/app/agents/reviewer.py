"""Reviewer Agent implementation - responsible for code review."""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message
from app.utils.prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


@dataclass
class ReviewFinding:
    """A single finding from a code review.

    Attributes:
        category: Severity category — critical, warning, or suggestion.
        title: Short summary of the finding.
        description: Detailed explanation of the issue.
        location: File path or code location (optional).
        suggestion: Suggested fix or improvement (optional).
    """

    category: str  # "critical" | "warning" | "suggestion"
    title: str
    description: str
    location: str = ""
    suggestion: str = ""


@dataclass
class ReviewResult:
    """Structured result of a code review.

    Attributes:
        findings: List of review findings categorized by severity.
        summary: Overall assessment summary.
        approved: Whether the code passes review.
    """

    findings: list[ReviewFinding] = field(default_factory=list)
    summary: str = ""
    approved: bool = True


class ReviewerAgent(BaseAgent):
    """Agent responsible for code review tasks.

    The Reviewer Agent analyzes code changes and provides structured
    feedback on quality, correctness, security, and best practices.
    Produces categorized findings (critical/warning/suggestion) and
    can read files directly when the file_read tool is available.

    Attributes:
        agent_type: Always AgentType.REVIEWER.
        default_tools: Auto-injected tools for code review.
    """

    default_tools = ["file_read", "code_search"]

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

        self.add_thinking_step(
            step="plan",
            thought=f"Planning code review for: {task[:200]}",
        )

        system_prompt = PromptTemplates.get_system_prompt("reviewer")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
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

        self.add_thinking_step(
            step="plan",
            thought="Review plan created",
            observation=plan[:200] if plan else "",
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code review plan using the LLM.

        Analyzes the code using available tools and generates
        structured review feedback with categorized findings.

        Args:
            plan: The review plan.
            context: Additional context for the review.

        Returns:
            The structured review findings.
        """
        logger.info("ReviewerAgent '%s' executing review plan", self.name)

        self.add_thinking_step(
            step="execute",
            thought="Starting code review execution",
        )

        system_prompt = PromptTemplates.get_system_prompt("reviewer")

        # Read actual file if file_read tool is available and path is provided
        code_to_review = context.get("code", "")
        if not code_to_review and "file_read" in self.tool_map:
            target_file = context.get("target_file", context.get("file_path", ""))
            if target_file:
                result = await self.use_tool("file_read", path=target_file)
                if result.success:
                    code_to_review = result.output
                    self.add_thinking_step(
                        step="execute",
                        thought=f"Read file for review: {target_file}",
                        action="file_read",
                    )

        if not code_to_review and "review" in plan.lower():
            code_to_review = plan

        # Determine if security-focused review is needed
        is_security_review = context.get("security_review", False)
        template_name = "security_review" if is_security_review else "code_review"

        try:
            task_prompt = PromptTemplates.render(
                template_name,
                code=code_to_review,
                task=plan,
            )
        except (ValueError, KeyError):
            task_prompt = PromptTemplates.render(
                "code_review",
                code=code_to_review,
                task=plan,
            )

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"{task_prompt}\n\n"
                f"Provide structured feedback in the following format:\n"
                f"```json\n"
                f"{{\n"
                f'  "findings": [\n'
                f'    {{"category": "critical|warning|suggestion", "title": "...", '
                f'"description": "...", "location": "...", "suggestion": "..."}}\n'
                f"  ],\n"
                f'  "summary": "Overall assessment",\n'
                f'  "approved": true|false\n'
                f"}}\n"
                f"```\n"
            )),
        ]

        review = await self.llm.complete(
            messages=messages,
            temperature=0.2,
            max_tokens=4096,
        )

        # Parse structured review output
        review_result = self._parse_review_output(review)

        self.add_thinking_step(
            step="execute",
            thought=f"Review completed: {len(review_result.findings)} findings, "
                    f"approved={review_result.approved}",
            observation=review_result.summary[:200] if review_result.summary else "",
        )

        self.artifacts.append({
            "type": "code_review",
            "plan": plan,
            "status": "completed",
            "review_length": len(review),
            "findings_count": len(review_result.findings),
            "approved": review_result.approved,
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

        self.add_thinking_step(
            step="reflect",
            thought="Reflecting on review completeness",
        )

        system_prompt = PromptTemplates.get_system_prompt("reviewer")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
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

        self.add_thinking_step(
            step="reflect",
            thought="Reflection completed",
            observation=reflection[:200] if reflection else "",
        )

        return reflection

    def _parse_review_output(self, review_text: str) -> ReviewResult:
        """Parse LLM review output into a structured ReviewResult.

        Attempts to extract a JSON block from the review text and
        parse it into ReviewFinding objects. Falls back to a simple
        result with the raw text as summary if parsing fails.

        Args:
            review_text: The raw LLM review output.

        Returns:
            A ReviewResult with parsed findings.
        """
        # Try to extract JSON block
        json_match = re.search(r"```json\s*(.*?)\s*```", review_text, re.DOTALL)
        if not json_match:
            json_match = re.search(r"\{.*\}", review_text, re.DOTALL)

        if json_match:
            try:
                data = json.loads(json_match.group(1) if json_match.lastindex else json_match.group(0))
                findings: list[ReviewFinding] = []
                for f in data.get("findings", []):
                    findings.append(ReviewFinding(
                        category=f.get("category", "suggestion"),
                        title=f.get("title", ""),
                        description=f.get("description", ""),
                        location=f.get("location", ""),
                        suggestion=f.get("suggestion", ""),
                    ))
                return ReviewResult(
                    findings=findings,
                    summary=data.get("summary", ""),
                    approved=data.get("approved", True),
                )
            except (json.JSONDecodeError, AttributeError):
                pass

        # Fallback: return raw text as summary
        return ReviewResult(
            findings=[],
            summary=review_text[:500],
            approved=True,
        )
