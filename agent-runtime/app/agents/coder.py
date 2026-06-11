"""Coder Agent implementation - responsible for code generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message

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
        """Create a code generation plan using the LLM.

        Analyzes the task to determine what code needs to be written,
        which files to modify, and what patterns to follow.

        Args:
            task: The code generation task description.
            context: Additional context (existing code, project structure, etc.).

        Returns:
            A plan describing the code to generate.
        """
        logger.info("CoderAgent '%s' planning task: %s", self.name, task)

        messages = [
            Message(role=MessageRole.SYSTEM, content=CODER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Analyze the following task and create a detailed code generation plan.\n\n"
                f"Task: {task}\n"
                f"Context: {context}\n\n"
                f"Output a structured plan covering:\n"
                f"1. Requirements analysis\n"
                f"2. Files to create/modify\n"
                f"3. Implementation approach\n"
                f"4. Key design decisions"
            )),
        ]

        plan = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code generation plan using the LLM and tools.

        Uses available tools (file_ops, terminal) to implement
        the code changes described in the plan.

        Args:
            plan: The code generation plan.
            context: Additional context for execution.

        Returns:
            A description of the generated code and changes made.
        """
        logger.info("CoderAgent '%s' executing plan", self.name)

        # Gather existing code context from tools if available
        existing_code = ""
        if "file_read" in self.tool_map and "target_file" in context:
            result = await self.use_tool("file_read", path=context["target_file"])
            if result.success:
                existing_code = result.output

        messages = [
            Message(role=MessageRole.SYSTEM, content=CODER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Generate production-ready code based on the following plan.\n\n"
                f"Plan: {plan}\n"
                f"Context: {context}\n"
                f"{'Existing code to modify:\n' + existing_code if existing_code else ''}\n\n"
                f"Output the complete code with:\n"
                f"- Full implementation (not placeholders)\n"
                f"- Type hints and docstrings\n"
                f"- Proper error handling\n"
                f"- Follow project conventions"
            )),
        ]

        code = await self.llm.complete(
            messages=messages,
            temperature=0.2,
            max_tokens=8192,
        )

        # Write generated code to file if target path is specified
        if "file_write" in self.tool_map and "output_file" in context:
            await self.use_tool("file_write", path=context["output_file"], content=code)

        self.artifacts.append({
            "type": "code_generation",
            "plan": plan,
            "status": "completed",
            "output_length": len(code),
        })

        return code

    async def reflect(self, execution_result: str) -> str:
        """Review generated code for quality and correctness using the LLM.

        Checks the generated code against best practices, project
        conventions, and the original task requirements.

        Args:
            execution_result: The result from code execution.

        Returns:
            A refined result after quality review.
        """
        logger.info("CoderAgent '%s' reflecting on results", self.name)

        messages = [
            Message(role=MessageRole.SYSTEM, content=CODER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Review the following generated code for quality and correctness.\n\n"
                f"Generated code:\n{execution_result}\n\n"
                f"Check for:\n"
                f"1. Correctness — any bugs or logic errors?\n"
                f"2. Completeness — does it fully implement the requirements?\n"
                f"3. Quality — proper error handling, type hints, docstrings?\n"
                f"4. Edge cases — are unusual inputs handled?\n\n"
                f"If issues are found, output the corrected code. "
                f"Otherwise, confirm the code is ready."
            )),
        ]

        reflection = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
        )

        return reflection
