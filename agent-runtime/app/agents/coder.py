"""Coder Agent implementation - responsible for code generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message
from app.utils.prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class CoderAgent(BaseAgent):
    """Agent responsible for code generation tasks.

    The Coder Agent analyzes task specifications and generates
    production-ready code following project conventions and best practices.
    Supports multi-file generation, incremental code modification, and
    optional code execution verification.

    Attributes:
        agent_type: Always AgentType.CODER.
        default_tools: Auto-injected tools for code generation.
    """

    default_tools = ["file_read", "file_write", "terminal", "code_search"]

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

        self.add_thinking_step(
            step="plan",
            thought=f"Analyzing task requirements: {task[:200]}",
        )

        system_prompt = PromptTemplates.get_system_prompt("coder")

        # Build context section with multi-file support
        context_section = self._build_context_section(context)

        # Choose template based on whether this is a modification
        if context.get("existing_code"):
            task_prompt = PromptTemplates.render(
                "code_modification",
                task=task,
                context=context_section,
                existing_code=context.get("existing_code", ""),
            )
        else:
            task_prompt = PromptTemplates.render(
                "code_generation",
                task=task,
                context=context_section,
            )

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"{task_prompt}\n\n"
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

        self.add_thinking_step(
            step="plan",
            thought="Plan created successfully",
            observation=plan[:200] if plan else "",
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the code generation plan using the LLM and tools.

        Uses available tools (file_ops, terminal) to implement
        the code changes described in the plan. Supports multi-file
        generation and incremental code modification.

        Args:
            plan: The code generation plan.
            context: Additional context for execution.

        Returns:
            A description of the generated code and changes made.
        """
        logger.info("CoderAgent '%s' executing plan", self.name)

        self.add_thinking_step(
            step="execute",
            thought="Starting code generation based on plan",
        )

        system_prompt = PromptTemplates.get_system_prompt("coder")

        # Gather existing code context from tools if available
        existing_code = context.get("existing_code", "")
        if not existing_code and "file_read" in self.tool_map and "target_file" in context:
            result = await self.use_tool("file_read", path=context["target_file"])
            if result.success:
                existing_code = result.output

        # Build multi-file context
        files_section = self._build_files_section(context)

        # Choose template based on modification vs. new code
        if existing_code:
            task_prompt = PromptTemplates.render(
                "code_modification",
                task=plan,
                context=self._build_context_section(context),
                existing_code=existing_code,
            )
        else:
            task_prompt = PromptTemplates.render(
                "code_generation",
                task=plan,
                context=self._build_context_section(context),
            )

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"{task_prompt}\n"
                f"{files_section}\n"
                f"{'Existing code to modify:\n```\n' + existing_code + '\n```\n' if existing_code else ''}\n"
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

        self.add_thinking_step(
            step="execute",
            thought="Code generated, writing to file(s)",
            action=f"Generated {len(code)} chars of code",
        )

        # Write generated code to file if target path is specified
        if "file_write" in self.tool_map and "output_file" in context:
            await self.use_tool("file_write", path=context["output_file"], content=code)

        # Handle multi-file output
        files = context.get("files", [])
        if files and "file_write" in self.tool_map:
            for file_info in files:
                path = file_info.get("path", "")
                content = file_info.get("content", "")
                if path and content:
                    await self.use_tool("file_write", path=path, content=content)

        # Code execution verification
        if context.get("verify") and "terminal" in self.tool_map and "output_file" in context:
            self.add_thinking_step(
                step="execute",
                thought="Verifying generated code by running it",
                action=f"Running: {context['output_file']}",
            )
            verify_result = await self.use_tool(
                "terminal",
                command=f"python {context['output_file']}",
                timeout=30,
            )
            if not verify_result.success:
                self.add_thinking_step(
                    step="execute",
                    thought="Code verification failed",
                    observation=verify_result.error or "",
                )

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

        self.add_thinking_step(
            step="reflect",
            thought="Reviewing generated code for quality and correctness",
        )

        system_prompt = PromptTemplates.get_system_prompt("coder")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
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

        self.add_thinking_step(
            step="reflect",
            thought="Reflection completed",
            observation=reflection[:200] if reflection else "",
        )

        return reflection

    def _build_context_section(self, context: dict[str, Any]) -> str:
        """Build a context description string from the context dict.

        Args:
            context: The context dictionary.

        Returns:
            Formatted context string for prompt inclusion.
        """
        parts: list[str] = []
        for key, value in context.items():
            if key in ("files", "existing_code", "verify"):
                continue
            parts.append(f"- {key}: {value}")
        return "\n".join(parts) if parts else "No additional context"

    def _build_files_section(self, context: dict[str, Any]) -> str:
        """Build a multi-file description section from context.

        Args:
            context: The context dictionary possibly containing a 'files' list.

        Returns:
            Formatted files section string for prompt inclusion.
        """
        files = context.get("files", [])
        if not files:
            return ""
        sections: list[str] = ["Files to generate/modify:"]
        for file_info in files:
            path = file_info.get("path", "unknown")
            description = file_info.get("description", "")
            sections.append(f"  - {path}: {description}" if description else f"  - {path}")
        return "\n".join(sections)
