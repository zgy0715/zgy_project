"""Git operations tool."""

import logging
from typing import Any

from app.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class GitTool(BaseTool):
    """Tool for performing Git operations.

    Provides a safe interface for common Git operations including
    status, diff, log, add, commit, and branch management.
    """

    def __init__(self, repo_path: str | None = None) -> None:
        """Initialize the Git tool.

        Args:
            repo_path: Path to the Git repository. If None, uses cwd.
        """
        super().__init__(
            name="git",
            description="Perform Git operations (status, diff, log, add, commit, branch).",
        )
        self.repo_path = repo_path

    async def run(
        self,
        operation: str,
        args: dict[str, Any] | None = None,
    ) -> ToolResult:
        """Execute a Git operation.

        Args:
            operation: The Git operation to perform.
            args: Operation-specific arguments.

        Returns:
            ToolResult with the operation output.
        """
        args = args or {}

        try:
            if operation == "status":
                return await self._status()
            elif operation == "diff":
                return await self._diff(args.get("target", ""))
            elif operation == "log":
                return await self._log(args.get("count", 10))
            elif operation == "add":
                return await self._add(args.get("files", []))
            elif operation == "commit":
                return await self._commit(args.get("message", ""))
            elif operation == "branch":
                return await self._branch(args.get("action", "list"))
            else:
                return ToolResult(
                    success=False,
                    error=f"Unknown Git operation: {operation}",
                )

        except Exception as e:
            logger.error("Git operation '%s' failed: %s", operation, str(e))
            return ToolResult(success=False, error=str(e))

    async def _status(self) -> ToolResult:
        """Get the repository status.

        Returns:
            ToolResult with the status output.
        """
        # TODO: Integrate with GitPython for actual implementation
        try:
            import git

            repo = git.Repo(self.repo_path or ".")
            status_output = []
            if repo.is_dirty():
                status_output.append("Modified files:")
                for item in repo.index.diff(None):
                    status_output.append(f"  M {item.a_path}")
                for item in repo.index.diff("HEAD"):
                    status_output.append(f"  S {item.a_path}")
            else:
                status_output.append("Working tree clean")

            return ToolResult(
                success=True,
                output="\n".join(status_output),
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _diff(self, target: str = "") -> ToolResult:
        """Get the diff of changes.

        Args:
            target: Optional target (commit, branch, file) to diff against.

        Returns:
            ToolResult with the diff output.
        """
        # TODO: Integrate with GitPython for actual implementation
        return ToolResult(
            success=True,
            output=f"Git diff output (placeholder, target={target})",
        )

    async def _log(self, count: int = 10) -> ToolResult:
        """Get the commit log.

        Args:
            count: Number of commits to return.

        Returns:
            ToolResult with the log output.
        """
        # TODO: Integrate with GitPython for actual implementation
        return ToolResult(
            success=True,
            output=f"Git log (last {count} commits, placeholder)",
        )

    async def _add(self, files: list[str]) -> ToolResult:
        """Stage files for commit.

        Args:
            files: List of file paths to stage.

        Returns:
            ToolResult indicating success.
        """
        # TODO: Integrate with GitPython for actual implementation
        return ToolResult(
            success=True,
            output=f"Staged {len(files)} files (placeholder)",
        )

    async def _commit(self, message: str) -> ToolResult:
        """Create a commit with the staged changes.

        Args:
            message: Commit message.

        Returns:
            ToolResult with the commit hash.
        """
        if not message:
            return ToolResult(success=False, error="Commit message is required")

        # TODO: Integrate with GitPython for actual implementation
        return ToolResult(
            success=True,
            output=f"Committed with message: {message} (placeholder)",
        )

    async def _branch(self, action: str = "list") -> ToolResult:
        """Manage branches.

        Args:
            action: Branch action (list, create, delete, checkout).

        Returns:
            ToolResult with the branch operation result.
        """
        # TODO: Integrate with GitPython for actual implementation
        return ToolResult(
            success=True,
            output=f"Git branch {action} (placeholder)",
        )

    def get_schema(self) -> dict[str, Any]:
        """Return the tool's parameter schema."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "enum": ["status", "diff", "log", "add", "commit", "branch"],
                        "description": "The Git operation to perform.",
                    },
                    "args": {
                        "type": "object",
                        "description": "Operation-specific arguments.",
                    },
                },
                "required": ["operation"],
            },
        }
