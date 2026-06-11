"""Deployer Agent implementation - responsible for deployment configuration generation."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.models.enums import AgentType, MessageRole
from app.models.schemas import Message

logger = logging.getLogger(__name__)

DEPLOYER_SYSTEM_PROMPT = """You are a Deployer Agent in the DeepAgent system.
Your primary responsibility is to generate deployment configurations and infrastructure code.

Key responsibilities:
- Generate Dockerfile and docker-compose configurations
- Create CI/CD pipeline configurations (GitHub Actions, GitLab CI, etc.)
- Produce Kubernetes manifests and Helm charts
- Configure environment variables and secrets management
- Set up monitoring and logging configurations

Deployment principles:
- Follow infrastructure-as-code best practices
- Ensure reproducible and deterministic deployments
- Implement proper health checks and readiness probes
- Configure appropriate resource limits
- Use multi-stage builds for optimized images
"""


class DeployerAgent(BaseAgent):
    """Agent responsible for deployment configuration generation.

    The Deployer Agent generates infrastructure code, Docker configurations,
    CI/CD pipelines, and other deployment-related artifacts.

    Attributes:
        agent_type: Always AgentType.DEPLOYER.
    """

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

        messages = [
            Message(role=MessageRole.SYSTEM, content=DEPLOYER_SYSTEM_PROMPT),
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

        return plan

    async def execute(self, plan: str, context: dict[str, Any]) -> str:
        """Execute the deployment configuration plan using the LLM.

        Generates deployment artifacts using available tools and the LLM.

        Args:
            plan: The deployment plan.
            context: Additional context for deployment configuration.

        Returns:
            The generated deployment configuration(s).
        """
        logger.info("DeployerAgent '%s' executing deployment plan", self.name)

        tech_stack = context.get("tech_stack", [])
        project_name = context.get("project_name", "project")

        messages = [
            Message(role=MessageRole.SYSTEM, content=DEPLOYER_SYSTEM_PROMPT),
            Message(role=MessageRole.USER, content=(
                f"Generate deployment configurations based on the following plan.\n\n"
                f"Plan: {plan}\n"
                f"Project: {project_name}\n"
                f"Tech stack: {', '.join(tech_stack) if tech_stack else 'unknown'}\n"
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

        messages = [
            Message(role=MessageRole.SYSTEM, content=DEPLOYER_SYSTEM_PROMPT),
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

        return reflection
