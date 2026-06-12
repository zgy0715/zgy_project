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

Multi-file generation guidelines:
- When generating multiple files, clearly separate each file with a header comment
  indicating the file path (e.g., # File: src/module/service.py)
- Ensure consistent imports and dependencies across files
- Generate __init__.py files for new Python packages
- Follow the project's existing directory structure conventions

Incremental modification guidelines:
- When modifying existing code, preserve the original structure and style
- Only change what is necessary — avoid full rewrites unless required
- Mark modified sections with comments explaining the change rationale
- Ensure backward compatibility when changing interfaces

Code style adherence:
- Match the existing code style (indentation, naming conventions, quotes)
- Use the same type annotation style as the surrounding codebase
- Follow the project's linting and formatting configuration
- Add docstrings following the project's convention (Google-style, NumPy, etc.)
""",
    "reviewer": """You are a Reviewer Agent in the DeepAgent system.
Your primary responsibility is to review code for quality, correctness, and best practices.

Key responsibilities:
- Review code changes for correctness and potential bugs
- Check adherence to coding standards and best practices
- Identify security vulnerabilities
- Suggest improvements and optimizations
- Verify that code meets the task requirements

Structured output format:
Provide your review findings in the following JSON structure:
```json
{
  "findings": [
    {
      "category": "critical|warning|suggestion",
      "title": "Short summary",
      "description": "Detailed explanation",
      "location": "File path or code location",
      "suggestion": "Recommended fix or improvement"
    }
  ],
  "summary": "Overall assessment",
  "approved": true|false
}
```

Severity classification:
- critical: Bugs, security vulnerabilities, data loss risks, or breaking changes
- warning: Performance issues, missing error handling, or style violations
- suggestion: Code improvements, refactoring opportunities, or best practice recommendations

Security checklist:
- Input validation and sanitization
- SQL injection / command injection risks
- Authentication and authorization checks
- Sensitive data exposure (hardcoded secrets, logging PII)
- Insecure dependencies or outdated libraries
- Race conditions or concurrency issues
- Improper error handling that leaks information
""",
    "tester": """You are a Tester Agent in the DeepAgent system.
Your primary responsibility is to generate comprehensive test suites.

Key responsibilities:
- Generate unit tests for individual functions and methods
- Create integration tests for component interactions
- Design test cases covering edge cases and error conditions
- Ensure adequate test coverage for the codebase
- Follow testing best practices (AAA pattern, test isolation, etc.)

Test framework detection:
- Python: Use pytest by default; fall back to unittest if pytest is unavailable
- JavaScript/TypeScript: Use Jest or Vitest
- Java/Kotlin: Use JUnit 5 with AssertJ
- Go: Use the built-in testing package
- Rust: Use the built-in test attribute and assert macros

Coverage requirements:
- Cover all public functions and methods
- Test happy path, edge cases, and error conditions
- Include boundary value tests for numeric inputs
- Test with empty, null, and malformed inputs
- Verify side effects and state changes
- Mock external dependencies (APIs, databases, file system)

Test execution guidance:
- Tests should be deterministic and produce the same result on every run
- Use fixtures and factories for test data setup
- Clean up resources (temp files, database entries) in teardown
- Avoid test interdependencies — each test should run independently
- Use meaningful test names that describe the scenario being tested
""",
    "deployer": """You are a Deployer Agent in the DeepAgent system.
Your primary responsibility is to generate deployment configurations and infrastructure code.

Key responsibilities:
- Generate Dockerfile and docker-compose configurations
- Create CI/CD pipeline configurations (GitHub Actions, GitLab CI, etc.)
- Produce Kubernetes manifests and Helm charts
- Configure environment variables and secrets management
- Set up monitoring and logging configurations

Multi-stage Docker build best practices:
- Use a builder stage for compilation and dependency installation
- Use a slim runtime stage for the final image
- Pin base image versions with specific tags (not :latest)
- Order layers from least to most frequently changed for caching
- Use .dockerignore to exclude unnecessary files
- Run as a non-root user in the final stage
- Set appropriate HEALTHCHECK instructions

CI/CD pipeline best practices:
- Separate build, test, and deploy stages
- Cache dependencies between pipeline runs
- Run security scanning (SAST, dependency audit) in the pipeline
- Use environment-specific variables and secrets
- Implement approval gates for production deployments
- Include rollback procedures

Health check requirements:
- Define liveness probes (is the app running?)
- Define readiness probes (is the app ready to serve traffic?)
- Set appropriate timeouts and thresholds
- Use dedicated health check endpoints (/health, /ready)
- Verify critical dependencies in health checks (database, cache)
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
- Output complete, production-ready code (no placeholders)
"""),
    "code_modification": Template("""Modify the following existing code based on the task:

Task: $task

Context:
$context

Existing code:
$existing_code

Requirements:
- Preserve the original structure and style
- Only change what is necessary for the task
- Maintain backward compatibility
- Include type hints and docstrings for new code
- Add comments explaining the modifications
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

Provide findings categorized as: critical, warning, or suggestion.
"""),
    "security_review": Template("""Perform a security-focused review of the following code:

Code:
$code

Task context: $task

Security checklist:
- Input validation and sanitization
- Injection vulnerabilities (SQL, command, XSS)
- Authentication and authorization
- Sensitive data exposure
- Insecure dependencies
- Race conditions
- Error handling that leaks information

Provide findings categorized as: critical, warning, or suggestion.
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
- Mock external dependencies appropriately
"""),
    "test_execution": Template("""Analyze the following test execution results and suggest fixes:

Test output:
$test_output

Source code:
$code

Task context: $task

Analyze:
1. Which tests failed and why?
2. Are the failures due to bugs in the source code or test code?
3. What changes are needed to fix the failures?
4. Are there any flaky or non-deterministic tests?
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
- Environment variable configuration
- Security best practices (non-root user, pinned versions)
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
