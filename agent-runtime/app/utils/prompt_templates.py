"""Prompt template management for agent system prompts and task templates."""

import logging
from string import Template
from typing import Any

logger = logging.getLogger(__name__)

# System prompts for each agent type
SYSTEM_PROMPTS: dict[str, str] = {
    "coder": """You are a Coder Agent in the DeepAgent system.
Your primary responsibility is to generate high-quality, production-ready code.

Key responsibilities:
- Write clean, well-structured code following best practices
- Implement features based on task specifications
- Follow existing code patterns and conventions in the project
- Include appropriate error handling and type hints
- Generate code that is testable and maintainable
""",
    "reviewer": """You are a Reviewer Agent in the DeepAgent system.
Your primary responsibility is to review code for quality, correctness, and best practices.

Key responsibilities:
- Review code changes for correctness and potential bugs
- Check adherence to coding standards and best practices
- Identify security vulnerabilities
- Suggest improvements and optimizations
- Verify that code meets the task requirements
""",
    "tester": """You are a Tester Agent in the DeepAgent system.
Your primary responsibility is to generate comprehensive test suites.

Key responsibilities:
- Generate unit tests for individual functions and methods
- Create integration tests for component interactions
- Design test cases covering edge cases and error conditions
- Ensure adequate test coverage for the codebase
- Follow testing best practices (AAA pattern, test isolation, etc.)
""",
    "deployer": """You are a Deployer Agent in the DeepAgent system.
Your primary responsibility is to generate deployment configurations.

Key responsibilities:
- Generate Dockerfile and docker-compose configurations
- Create CI/CD pipeline configurations
- Produce Kubernetes manifests and Helm charts
- Configure environment variables and secrets management
- Set up monitoring and logging configurations
""",
}

# Task prompt templates
TASK_TEMPLATES: dict[str, Template] = {
    "code_generation": Template("""Generate code for the following task:

Task: $task

Context:
$context

Requirements:
- Follow existing code patterns and conventions
- Include type hints and docstrings
- Add appropriate error handling
- Ensure the code is testable
"""),
    "code_review": Template("""Review the following code changes:

Code:
$code

Task context: $task

Review criteria:
- Code correctness and logic errors
- Error handling completeness
- Security considerations
- Performance implications
- Code style and conventions
"""),
    "test_generation": Template("""Generate tests for the following code:

Code:
$code

Task context: $task

Testing requirements:
- Unit tests for core functions
- Edge case coverage
- Error handling tests
- Use meaningful test names
- Follow AAA pattern (Arrange, Act, Assert)
"""),
    "deployment": Template("""Generate deployment configuration for the following project:

Project: $project_name
Tech stack: $tech_stack
Code summary: $code_summary

Requirements:
- Dockerfile with multi-stage build
- docker-compose.yml for local development
- CI/CD pipeline configuration
- Health checks and readiness probes
"""),
    "reflection": Template("""Review and refine the following output:

Original task: $task
Output: $output

Check for:
- Completeness: Does it fully address the task?
- Correctness: Are there any errors or issues?
- Quality: Does it follow best practices?
- Improvements: Can anything be improved?
"""),
}


class PromptTemplates:
    """Manager for prompt templates used by agents.

    Provides access to system prompts and task-specific templates
    with variable substitution support.

    Example:
        >>> templates = PromptTemplates()
        >>> system_prompt = templates.get_system_prompt("coder")
        >>> task_prompt = templates.render("code_generation", task="Build API", context="...")
    """

    @staticmethod
    def get_system_prompt(agent_type: str) -> str:
        """Get the system prompt for an agent type.

        Args:
            agent_type: The agent type identifier.

        Returns:
            The system prompt string.

        Raises:
            ValueError: If the agent type is unknown.
        """
        if agent_type not in SYSTEM_PROMPTS:
            raise ValueError(f"Unknown agent type: {agent_type}")
        return SYSTEM_PROMPTS[agent_type]

    @staticmethod
    def render(template_name: str, **kwargs: Any) -> str:
        """Render a task template with the given variables.

        Args:
            template_name: Name of the template to render.
            **kwargs: Template variables for substitution.

        Returns:
            The rendered prompt string.

        Raises:
            ValueError: If the template name is unknown.
            KeyError: If a required variable is missing.
        """
        if template_name not in TASK_TEMPLATES:
            raise ValueError(f"Unknown template: {template_name}")

        template = TASK_TEMPLATES[template_name]
        return template.substitute(**kwargs)

    @staticmethod
    def list_templates() -> list[str]:
        """List all available template names.

        Returns:
            List of template name strings.
        """
        return list(TASK_TEMPLATES.keys())

    @staticmethod
    def list_agent_types() -> list[str]:
        """List all agent types with system prompts.

        Returns:
            List of agent type strings.
        """
        return list(SYSTEM_PROMPTS.keys())
