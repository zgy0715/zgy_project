"""Tester Agent implementation - responsible for test generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message
from app.utils.prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class TesterAgent(BaseAgent):
    """Agent responsible for test generation tasks.

    The Tester Agent analyzes code and generates comprehensive test
    suites following testing best practices. Supports test framework
    detection and optional test execution via the terminal tool.

    Attributes:
        agent_type: Always AgentType.TESTER.
        default_tools: Auto-injected tools for test generation.
    """

    default_tools = ["file_read", "file_write", "terminal", "code_search"]

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

        self.add_thinking_step(
            step="plan",
            thought=f"Planning test generation for: {task[:200]}",
        )

        system_prompt = PromptTemplates.get_system_prompt("tester")

        # Detect test framework from context
        framework = self._detect_framework(context)

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"Create a test generation plan for the following task.\n\n"
                f"Task: {task}\n"
                f"Detected framework: {framework}\n"
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

        self.add_thinking_step(
            step="plan",
            thought="Test plan created",
            observation=plan[:200] if plan else "",
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the test generation plan using the LLM.

        Generates test code using available tools and the LLM.
        Optionally runs the generated tests if the terminal tool
        is available and context requests execution.

        Args:
            plan: The test generation plan.
            context: Additional context for test generation.

        Returns:
            The generated test code.
        """
        logger.info("TesterAgent '%s' executing test plan", self.name)

        self.add_thinking_step(
            step="execute",
            thought="Starting test code generation",
        )

        system_prompt = PromptTemplates.get_system_prompt("tester")

        code_under_test = context.get("code", "")

        # Read code from file if not provided in context
        if not code_under_test and "file_read" in self.tool_map:
            target_file = context.get("target_file", context.get("source_file", ""))
            if target_file:
                result = await self.use_tool("file_read", path=target_file)
                if result.success:
                    code_under_test = result.output
                    self.add_thinking_step(
                        step="execute",
                        thought=f"Read source file for testing: {target_file}",
                        action="file_read",
                    )

        # Detect test framework
        framework = self._detect_framework(context)

        try:
            task_prompt = PromptTemplates.render(
                "test_generation",
                code=code_under_test,
                task=plan,
            )
        except (ValueError, KeyError):
            task_prompt = f"Generate tests for:\n{code_under_test}\n\nTask: {plan}"

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"{task_prompt}\n\n"
                f"Detected framework: {framework}\n"
                f"Requirements:\n"
                f"- Use the {framework} test framework\n"
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

        self.add_thinking_step(
            step="execute",
            thought="Test code generated",
            action=f"Generated {len(test_code)} chars of test code",
        )

        # Write test file if output path is specified
        write_error: str | None = None
        if "file_write" in self.tool_map and "output_file" in context:
            write_result = await self.use_tool(
                "file_write",
                path=context["output_file"],
                content=test_code,
            )
            if not getattr(write_result, "success", True):
                write_error = (
                    getattr(write_result, "error", None)
                    or "Unknown file_write error"
                )
                logger.warning(
                    "TesterAgent '%s' could not write test file %s: %s",
                    self.name,
                    context["output_file"],
                    write_error,
                )
                self.add_thinking_step(
                    step="execute",
                    thought="Failed to write generated tests to disk",
                    observation=write_error[:200],
                )

        # Run generated tests if terminal tool is available and execution is
        # requested. argv[0] must be an allow-listed binary from
        # app/tools/terminal.py's ALLOWED_COMMANDS: "pytest" is allow-listed,
        # while a bare interpreter ("python") deliberately is not — invoking
        # "python -m pytest ..." would be rejected by the security policy.
        test_run: dict[str, Any] | None = None
        if context.get("run_tests") and "terminal" in self.tool_map and "output_file" in context:
            if write_error is not None:
                # Nothing new to execute — surface the write failure rather than
                # reporting a passing run against a stale or missing file.
                test_run = {
                    "executed": False,
                    "success": False,
                    "command": None,
                    "error": (
                        "Tests not executed: failed to write test file "
                        f"({write_error})"
                    ),
                }
            else:
                command = f"pytest {context['output_file']} -v"
                self.add_thinking_step(
                    step="execute",
                    thought="Running generated tests",
                    action=f"Executing: {command}",
                )
                run_result = await self.use_tool(
                    "terminal",
                    command=command,
                    timeout=60,
                )
                run_output = getattr(run_result, "output", None) or ""
                run_error = getattr(run_result, "error", None)

                if run_result.success:
                    self.add_thinking_step(
                        step="execute",
                        thought="Tests executed successfully",
                        observation=run_output[:200],
                    )
                else:
                    # Either the command was rejected by the security policy or
                    # the tests genuinely failed; record it so a failure is
                    # never silently reported as success.
                    failure_reason = run_error or run_output or "unknown error"
                    logger.warning(
                        "TesterAgent '%s' test run failed (%s): %s",
                        self.name,
                        command,
                        failure_reason[:200],
                    )
                    self.add_thinking_step(
                        step="execute",
                        thought="Test execution failed",
                        observation=failure_reason[:200],
                    )

                test_run = {
                    "executed": True,
                    "success": bool(run_result.success),
                    "command": command,
                    "error": run_error,
                    "output_tail": run_output[-2000:] if run_output else "",
                }

        artifact: dict[str, Any] = {
            "type": "test_generation",
            "plan": plan,
            "status": "completed",
            "output_length": len(test_code),
            "framework": framework,
        }
        if write_error is not None:
            artifact["file_write_error"] = write_error
        if test_run is not None:
            artifact["test_run"] = test_run
            artifact["tests_passed"] = test_run["success"]
        self.artifacts.append(artifact)

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

        self.add_thinking_step(
            step="reflect",
            thought="Reviewing test quality and coverage",
        )

        system_prompt = PromptTemplates.get_system_prompt("tester")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
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

        self.add_thinking_step(
            step="reflect",
            thought="Reflection completed",
            observation=reflection[:200] if reflection else "",
        )

        return reflection

    def _detect_framework(self, context: dict[str, Any]) -> str:
        """Detect the appropriate test framework from context.

        Examines the context for hints about the project's test
        framework, falling back to pytest as the default.

        Args:
            context: The context dictionary that may contain framework hints.

        Returns:
            The detected test framework name.
        """
        # Explicit override
        if "test_framework" in context:
            return context["test_framework"]

        # Heuristic detection from file paths or tech stack
        tech_stack = context.get("tech_stack", [])
        source_file = context.get("source_file", context.get("target_file", ""))

        # JavaScript/TypeScript
        if any(t.lower() in ("javascript", "typescript", "node", "nodejs") for t in tech_stack):
            return "jest"
        if source_file.endswith((".ts", ".tsx", ".js", ".jsx")):
            return "jest"

        # Java
        if any(t.lower() in ("java", "kotlin") for t in tech_stack):
            return "junit"
        if source_file.endswith((".java", ".kt")):
            return "junit"

        # Go
        if "go" in [t.lower() for t in tech_stack]:
            return "go test"
        if source_file.endswith(".go"):
            return "go test"

        # Rust
        if any(t.lower() in ("rust", "cargo") for t in tech_stack):
            return "rust test"
        if source_file.endswith(".rs"):
            return "rust test"

        # Default: Python with pytest
        return "pytest"
