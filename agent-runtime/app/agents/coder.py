"""Coder Agent implementation - responsible for code generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType

logger = logging.getLogger(__name__)

CODER_SYSTEM_PROMPT = """You are a Coder Agent in the DeepAgent system.
Your primary responsibility is to generate high-quality, production-ready code.

Key responsibilities:
- Write clean, well-structured code following best practices
- Implement features based on task specifications
- Follow existing code patterns and conventions in the project
- Include appropriate error handling and type hints
- Generate code that is testable and maintainable

Always consider:
- Code correctness and edge cases
- Performance implications
- Security best practices
- Compatibility with existing codebase
"""


class CoderAgent(BaseAgent):
    """Agent responsible for code generation tasks.

    The Coder Agent analyzes task specifications and generates
    production-ready code following project conventions and best practices.

    Attributes:
        agent_type: Always AgentType.CODER.
    """

    @property
    def agent_type(self) -> AgentType:
        """Return the coder agent type."""
        return AgentType.CODER

    async def plan(self, task: str, context: dict[str, Any]) -> str:
        """Create a code generation plan.

        Analyzes the task to determine what code needs to be written,
        which files to modify, and what patterns to follow.

        Args:
            task: The code generation task description.
            context: Additional context (existing code, project structure, etc.).

        Returns:
            A plan describing the code to generate.
        """
        logger.info("CoderAgent '%s' planning task: %s", self.name, task)

        # TODO: Integrate with LLM service for plan generation
        plan = (
            f"Code generation plan for: {task}\n"
            f"1. Analyze requirements and existing codebase context\n"
            f"2. Identify files to create or modify\n"
            f"3. Design the implementation approach\n"
            f"4. Generate code following project conventions\n"
            f"5. Add type hints and docstrings"
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code generation plan.

        Uses available tools (file_ops, terminal) to implement
        the code changes described in the plan.

        Args:
            plan: The code generation plan.
            context: Additional context for execution.

        Returns:
            A description of the generated code and changes made.
        """
        logger.info("CoderAgent '%s' executing plan", self.name)

        # TODO: Integrate with LLM service and tools for actual code generation
        execution_result = (
            f"Executed code generation plan:\n{plan}\n\n"
            f"Generated code artifacts (placeholder)."
        )

        self.artifacts.append({
            "type": "code_generation",
            "plan": plan,
            "status": "completed",
        })

        return execution_result

    async def reflect(self, execution_result: str) -> str:
        """Review generated code for quality and correctness.

        Checks the generated code against best practices, project
        conventions, and the original task requirements.

        Args:
            execution_result: The result from code execution.

        Returns:
            A refined result after quality review.
        """
        logger.info("CoderAgent '%s' reflecting on results", self.name)

        # TODO: Integrate with LLM service for code review reflection
        reflection = (
            f"Code generation review:\n{execution_result}\n\n"
            f"Quality check completed (placeholder)."
        )

        return reflection
