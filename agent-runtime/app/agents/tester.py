"""Tester Agent implementation - responsible for test generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message

logger = logging.getLogger(__name__)

TESTER_SYSTEM_PROMPT = """You are a Tester Agent in the DeepAgent system.
Your primary responsibility is to generate comprehensive test suites.

Key responsibilities:
- Generate unit tests for individual functions and methods
- Create integration tests for component interactions
- Design test cases covering edge cases and error conditions
- Ensure adequate test coverage for the codebase
- Follow testing best practices (AAA pattern, test isolation, etc.)

Testing principles:
- Test behavior, not implementation
- Cover happy paths and error paths
- Use meaningful test names that describe the scenario
- Keep tests independent and deterministic
- Mock external dependencies appropriately
"""


class TesterAgent(BaseAgent):
    """Agent responsible for test generation tasks.

    The Tester Agent analyzes code and generates comprehensive test
    suites following testing best practices.

    Attributes:
        agent_type: Always AgentType.TESTER.
    """

    @property
    def agent_type(self) -> AgentType:
        """Return the tester agent type."""
        return AgentType.TESTER

    async def plan(self, task: str, context: dict[str, Any]) -> str:
        """Create a test generation plan using the LLM.

        Analyzes the code to determine what tests are needed,
        what scenarios to cover, and what testing patterns to use.

        Args:
            task: The test generation task description.
            context: Additional context (code to test, existing tests, etc.).

        Returns:
            A plan describing the test generation approach.
        """
        logger.info("TesterAgent '%s' planning test generation: %s", self.name, task)

        messages = [
            Message(role=MessageRole.SYSTEM, content=TESTER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Create a test generation plan for the following task.\n\n"
                f"Task: {task}\n"
                f"Context: {context}\n\n"
                f"Outline:\n"
                f"1. Testable units and components to test\n"
                f"2. Test scenarios (happy path, edge cases, errors)\n"
                f"3. Test structure and fixtures needed\n"
                f"4. Mocking strategy for external dependencies"
            )),
        ]

        plan = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the test generation plan using the LLM.

        Generates test code using available tools and the LLM.

        Args:
            plan: The test generation plan.
            context: Additional context for test generation.

        Returns:
            The generated test code.
        """
        logger.info("TesterAgent '%s' executing test plan", self.name)

        code_under_test = context.get("code", "")

        messages = [
            Message(role=MessageRole.SYSTEM, content=TESTER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Generate comprehensive tests based on the following plan.\n\n"
                f"Plan: {plan}\n"
                f"{'Code under test:\n' + code_under_test if code_under_test else ''}\n"
                f"Context: {context}\n\n"
                f"Requirements:\n"
                f"- Use the appropriate test framework (pytest, unittest, jest, etc.)\n"
                f"- Follow AAA pattern (Arrange, Act, Assert)\n"
                f"- Cover happy path, edge cases, and error conditions\n"
                f"- Use meaningful test names\n"
                f"- Include comments explaining test scenarios"
            )),
        ]

        test_code = await self.llm.complete(
            messages=messages,
            temperature=0.2,
            max_tokens=8192,
        )

        self.artifacts.append({
            "type": "test_generation",
            "plan": plan,
            "status": "completed",
            "output_length": len(test_code),
        })

        return test_code

    async def reflect(self, execution_result: str) -> str:
        """Reflect on generated tests for coverage and quality using the LLM.

        Ensures the generated tests are comprehensive, correct,
        and follow testing best practices.

        Args:
            execution_result: The generated test results.

        Returns:
            Refined test suite after quality review.
        """
        logger.info("TesterAgent '%s' reflecting on test quality", self.name)

        messages = [
            Message(role=MessageRole.SYSTEM, content=TESTER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Review the following generated tests for quality and coverage.\n\n"
                f"Generated tests:\n{execution_result}\n\n"
                f"Check:\n"
                f"1. Coverage — are all important scenarios covered?\n"
                f"2. Correctness — will the tests actually pass?\n"
                f"3. Isolation — are tests independent of each other?\n"
                f"4. Maintainability — are tests clear and well-structured?\n\n"
                f"Output improved tests if issues are found, or confirm quality."
            )),
        ]

        reflection = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
        )

        return reflection
