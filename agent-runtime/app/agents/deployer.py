"""Deployer Agent implementation - responsible for deployment configuration generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message
from app.utils.prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class DeployerAgent(BaseAgent):
    """Agent responsible for deployment configuration generation.

    The Deployer Agent generates infrastructure code, Docker configurations,
    CI/CD pipelines, and other deployment-related artifacts. Can write
    generated configs to files when the file_write tool is available.

    Attributes:
        agent_type: Always AgentType.DEPLOYER.
        default_tools: Auto-injected tools for deployment tasks.
    """

    default_tools = ["file_read", "file_write", "terminal", "git_ops"]

    @property
    def agent_type(self) -> AgentType:
        """Return the deployer agent type."""
        return AgentType.DEPLOYER

    async def plan(self, task: str, context: dict[str, Any]) -> str:
        """Create a deployment configuration plan using the LLM.

        Analyzes the project to determine deployment requirements,
        target environments, and necessary infrastructure.

        Args:
            task: The deployment task description.
            context: Additional context (project structure, tech stack, etc.).

        Returns:
            A plan describing the deployment configuration approach.
        """
        logger.info("DeployerAgent '%s' planning deployment: %s", self.name, task)

        self.add_thinking_step(
            step="plan",
            thought=f"Planning deployment for: {task[:200]}",
        )

        system_prompt = PromptTemplates.get_system_prompt("deployer")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"Create a deployment configuration plan for the following task.\n\n"
                f"Task: {task}\n"
                f"Context: {context}\n\n"
                f"Outline:\n"
                f"1. Project structure and dependency analysis\n"
                f"2. Target deployment environment\n"
                f"3. Containerization strategy\n"
                f"4. CI/CD pipeline design\n"
                f"5. Monitoring and health check configuration"
            )),
        ]

        plan = await self.llm.complete(
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )

        self.add_thinking_step(
            step="plan",
            thought="Deployment plan created",
            observation=plan[:200] if plan else "",
        )

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the deployment configuration plan using the LLM.

        Generates deployment artifacts using available tools and the LLM.
        Writes generated configs to files when the file_write tool is
        available and output paths are specified.

        Args:
            plan: The deployment plan.
            context: Additional context for deployment configuration.

        Returns:
            The generated deployment configuration(s).
        """
        logger.info("DeployerAgent '%s' executing deployment plan", self.name)

        self.add_thinking_step(
            step="execute",
            thought="Starting deployment config generation",
        )

        system_prompt = PromptTemplates.get_system_prompt("deployer")

        tech_stack = context.get("tech_stack", [])
        project_name = context.get("project_name", "project")

        try:
            task_prompt = PromptTemplates.render(
                "deployment",
                project_name=project_name,
                tech_stack=", ".join(tech_stack) if tech_stack else "unknown",
                code_summary=plan,
            )
        except (ValueError, KeyError):
            task_prompt = (
                f"Generate deployment configurations for project: {project_name}\n"
                f"Tech stack: {', '.join(tech_stack) if tech_stack else 'unknown'}\n"
                f"Plan: {plan}"
            )

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"{task_prompt}\n\n"
                f"Context: {context}\n\n"
                f"Generate:\n"
                f"1. Dockerfile with multi-stage build\n"
                f"2. docker-compose.yml for local development\n"
                f"3. CI/CD pipeline configuration (GitHub Actions)\n"
                f"4. Health check configuration\n\n"
                f"Follow best practices:\n"
                f"- Use specific base image versions\n"
                f"- Implement proper layer caching\n"
                f"- Include health checks and readiness probes\n"
                f"- Configure resource limits"
            )),
        ]

        deployment_config = await self.llm.complete(
            messages=messages,
            temperature=0.2,
            max_tokens=8192,
        )

        self.add_thinking_step(
            step="execute",
            thought="Deployment config generated",
            action=f"Generated {len(deployment_config)} chars of config",
        )

        # Write generated config to file if output path is specified
        if "file_write" in self.tool_map and "output_file" in context:
            await self.use_tool(
                "file_write",
                path=context["output_file"],
                content=deployment_config,
            )
            self.add_thinking_step(
                step="execute",
                thought="Wrote deployment config to file",
                action=f"file_write: {context['output_file']}",
            )

        self.artifacts.append({
            "type": "deployment_config",
            "plan": plan,
            "status": "completed",
            "output_length": len(deployment_config),
        })

        return deployment_config

    async def reflect(self, execution_result: str) -> str:
        """Reflect on deployment configurations for best practices using the LLM.

        Ensures the generated configurations follow security best
        practices, are optimized, and are production-ready.

        Args:
            execution_result: The generated deployment configurations.

        Returns:
            Refined deployment configurations after review.
        """
        logger.info("DeployerAgent '%s' reflecting on deployment config", self.name)

        self.add_thinking_step(
            step="reflect",
            thought="Reviewing deployment config for best practices",
        )

        system_prompt = PromptTemplates.get_system_prompt("deployer")

        messages = [
            Message(role=MessageRole.SYSTEM, content=system_prompt),
            Message(role=MessageRole.USER, content=(
                f"Review the following deployment configurations for best practices.\n\n"
                f"Deployment config:\n{execution_result}\n\n"
                f"Check:\n"
                f"1. Security — are secrets handled properly?\n"
                f"2. Performance — is the build optimized?\n"
                f"3. Reliability — are health checks configured?\n"
                f"4. Reproducibility — are versions pinned?\n\n"
                f"Output improved configurations if issues are found."
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
