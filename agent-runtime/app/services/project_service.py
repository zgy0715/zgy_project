"""Project management service."""

import logging
from datetime import datetime
from typing import Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Project:
    """Represents a project in the DeepAgent system.

    Attributes:
        id: Unique project identifier.
        name: Project name.
        path: Filesystem path to the project root.
        description: Project description.
        tech_stack: List of detected technologies.
        created_at: Project creation timestamp.
        updated_at: Last update timestamp.
        metadata: Additional project metadata.
    """

    id: str
    name: str
    path: str
    description: str = ""
    tech_stack: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)


class ProjectService:
    """Service for managing projects in the DeepAgent system.

    Handles project creation, retrieval, and analysis including
    tech stack detection and project structure indexing.

    Example:
        >>> service = ProjectService()
        >>> project = await service.create("my-app", "/path/to/project")
        >>> tech_stack = await service.detect_tech_stack(project.id)
    """

    def __init__(self) -> None:
        """Initialize the project service."""
        self._projects: dict[str, Project] = {}

    async def create(
        self,
        name: str,
        path: str,
        description: str = "",
    ) -> Project:
        """Create a new project.

        Args:
            name: Project name.
            path: Filesystem path to the project root.
            description: Project description.

        Returns:
            The created Project instance.
        """
        import uuid

        project_id = str(uuid.uuid4())
        project = Project(
            id=project_id,
            name=name,
            path=path,
            description=description,
        )

        self._projects[project_id] = project
        logger.info("Created project '%s' at %s", name, path)

        return project

    async def get(self, project_id: str) -> Project | None:
        """Retrieve a project by ID.

        Args:
            project_id: Unique project identifier.

        Returns:
            The Project instance, or None if not found.
        """
        return self._projects.get(project_id)

    async def list_projects(self) -> list[Project]:
        """List all registered projects.

        Returns:
            List of all Project instances.
        """
        return list(self._projects.values())

    async def detect_tech_stack(self, project_id: str) -> list[str]:
        """Detect the technology stack of a project.

        Analyzes project files (package.json, requirements.txt, Cargo.toml, etc.)
        to identify the technologies used.

        Args:
            project_id: Unique project identifier.

        Returns:
            List of detected technology names.
        """
        project = self._projects.get(project_id)
        if not project:
            return []

        tech_stack: list[str] = []
        project_path = project.path

        # Check for common project files
        from pathlib import Path

        root = Path(project_path)

        if (root / "package.json").exists():
            tech_stack.append("nodejs")
        if (root / "requirements.txt").exists() or (root / "pyproject.toml").exists():
            tech_stack.append("python")
        if (root / "Cargo.toml").exists():
            tech_stack.append("rust")
        if (root / "go.mod").exists():
            tech_stack.append("go")
        if (root / "pom.xml").exists() or (root / "build.gradle").exists():
            tech_stack.append("java")
        if (root / "Dockerfile").exists():
            tech_stack.append("docker")

        project.tech_stack = tech_stack
        project.updated_at = datetime.utcnow()

        logger.info("Detected tech stack for project %s: %s", project_id, tech_stack)
        return tech_stack

    async def delete(self, project_id: str) -> bool:
        """Delete a project.

        Args:
            project_id: Unique project identifier.

        Returns:
            True if the project was deleted, False if not found.
        """
        if project_id in self._projects:
            del self._projects[project_id]
            logger.info("Deleted project %s", project_id)
            return True
        return False
