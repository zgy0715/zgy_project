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

    def _get_repo(self) -> Any:
        """Get a GitPython Repo instance for the configured path."""
        import git
        return git.Repo(self.repo_path or ".")

    async def _status(self) -> ToolResult:
        """Get the repository status using GitPython.

        Returns:
            ToolResult with the status output.
        """
        try:
            repo = self._get_repo()
            status_output: list[str] = []

            if repo.is_dirty():
                status_output.append("Modified files:")
                for item in repo.index.diff(None):
                    status_output.append(f"  M {item.a_path}")
                for item in repo.index.diff("HEAD"):
                    change = "A" if item.new_file else "M"
                    status_output.append(f"  {change} {item.a_path}")

                # Untracked files
                untracked = repo.untracked_files
                if untracked:
                    status_output.append("Untracked files:")
                    for f in untracked:
                        status_output.append(f"  ? {f}")
            else:
                status_output.append("Working tree clean")

            # Current branch info
            try:
                branch = repo.active_branch.name
                status_output.insert(0, f"On branch: {branch}")
            except Exception:
                status_output.insert(0, "HEAD detached")

            return ToolResult(
                success=True,
                output="\n".join(status_output),
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _diff(self, target: str = "") -> ToolResult:
        """Get the diff of changes using GitPython.

        Args:
            target: Optional target (commit, branch, file) to diff against.

        Returns:
            ToolResult with the diff output.
        """
        try:
            repo = self._get_repo()
            if target:
                diff = repo.index.diff(target)
            else:
                diff = repo.index.diff(None)

            diff_output = [str(d).strip() for d in diff if d.a_blob and d.b_blob]
            return ToolResult(
                success=True,
                output="\n".join(diff_output) if diff_output else "No changes",
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _log(self, count: int = 10) -> ToolResult:
        """Get the commit log using GitPython.

        Args:
            count: Number of commits to return.

        Returns:
            ToolResult with the log output.
        """
        try:
            repo = self._get_repo()
            log_lines: list[str] = []
            for commit in repo.iter_commits(max_count=count):
                log_lines.append(
                    f"{commit.hexsha[:8]} {commit.author.name} "
                    f"{commit.message.split(chr(10))[0]}"
                )
            return ToolResult(
                success=True,
                output="\n".join(log_lines) if log_lines else "No commits found",
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _add(self, files: list[str]) -> ToolResult:
        """Stage files for commit using GitPython.

        Args:
            files: List of file paths to stage.

        Returns:
            ToolResult indicating success.
        """
        try:
            repo = self._get_repo()
            if files:
                repo.index.add(files)
                return ToolResult(
                    success=True,
                    output=f"Staged {len(files)} file(s): {', '.join(files)}",
                )
            else:
                repo.index.add("*")
                return ToolResult(
                    success=True,
                    output="All changes staged",
                )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _commit(self, message: str) -> ToolResult:
        """Create a commit with the staged changes using GitPython.

        Args:
            message: Commit message.

        Returns:
            ToolResult with the commit hash.
        """
        if not message:
            return ToolResult(success=False, error="Commit message is required")

        try:
            repo = self._get_repo()
            commit = repo.index.commit(message)
            return ToolResult(
                success=True,
                output=f"Committed: {commit.hexsha[:8]} - {message}",
                metadata={"hash": commit.hexsha},
            )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

    async def _branch(self, action: str = "list") -> ToolResult:
        """Manage branches using GitPython.

        Args:
            action: Branch action (list, create, delete, checkout).

        Returns:
            ToolResult with the branch operation result.
        """
        try:
            repo = self._get_repo()
            if action == "list":
                branches = [b.name for b in repo.branches]
                return ToolResult(
                    success=True,
                    output="Branches:\n" + "\n".join(f"  {b}" for b in branches),
                )
            elif action == "current":
                try:
                    return ToolResult(
                        success=True,
                        output=f"Current branch: {repo.active_branch.name}",
                    )
                except Exception:
                    return ToolResult(success=True, output="HEAD detached")
            else:
                return ToolResult(
                    success=False,
                    error=f"Branch action '{action}' requires a branch name argument",
                )
        except Exception as e:
            return ToolResult(success=False, error=str(e))

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
