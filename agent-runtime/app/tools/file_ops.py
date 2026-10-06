"""File read/write tools for agent file operations."""

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)

# Fallback maximum file size in bytes, used only when the configured
# security.max_file_size_mb setting cannot be read (default: 10 MB)
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def _get_max_file_size_bytes() -> int:
    """Get the maximum allowed file size in bytes from configuration.

    Fail-safe: falls back to the module default when the setting is absent.

    Returns:
        The configured maximum file size in bytes.
    """
    try:
        max_file_size_mb = get_settings().security.max_file_size_mb
    except Exception:
        return MAX_FILE_SIZE_BYTES
    return int(max_file_size_mb) * 1024 * 1024


def _get_allowed_directories() -> list[str]:
    """Get allowed directories from application configuration."""
    settings = get_settings()
    return settings.security.allowed_directories


def _is_path_allowed(path: str) -> bool:
    """Check if a file path is within allowed directories.

    Fail-closed: if no directories are configured, all access is denied.
    This prevents agents from accessing arbitrary filesystem paths.

    Args:
        path: The file path to check.

    Returns:
        True if the path is allowed, False otherwise.
    """
    allowed_dirs = _get_allowed_directories()
    if not allowed_dirs:
        logger.warning("No allowed directories configured — denying all file access")
        return False

    resolved = Path(path).resolve()
    return any(
        resolved.is_relative_to(Path(allowed).resolve())
        for allowed in allowed_dirs
    )


class FileReadTool(BaseTool):
    """Tool for reading file contents.

    Reads the content of a file at the specified path,
    with optional line range support.
    """

    def __init__(self) -> None:
        """Initialize the file read tool."""
        super().__init__(
            name="file_read",
            description="Read the contents of a file at the specified path.",
        )

    async def run(
        self,
        path: str,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> ToolResult:
        """Read file contents.

        Args:
            path: Absolute path to the file.
            start_line: Optional starting line number (1-based).
            end_line: Optional ending line number (inclusive).

        Returns:
            ToolResult with the file contents.
        """
        if not _is_path_allowed(path):
            return ToolResult(
                success=False,
                error=f"Access denied: path '{path}' is outside allowed directories",
            )

        try:
            file_path = Path(path)
            if not file_path.exists():
                return ToolResult(success=False, error=f"File not found: {path}")

            file_size = file_path.stat().st_size
            max_file_size = _get_max_file_size_bytes()
            if file_size > max_file_size:
                return ToolResult(
                    success=False,
                    error=f"File too large: {file_size} bytes (max: {max_file_size} bytes)",
                )

            content = file_path.read_text(encoding="utf-8")

            if start_line is not None or end_line is not None:
                lines = content.splitlines()
                start = (start_line or 1) - 1
                end = end_line or len(lines)
                content = "\n".join(lines[start:end])

            logger.info("Read file: %s (%d chars)", path, len(content))

            return ToolResult(
                success=True,
                output=content,
                metadata={"path": path, "size": len(content)},
            )

        except Exception as e:
            logger.error("Failed to read file %s: %s", path, str(e))
            return ToolResult(success=False, error=str(e))

    def get_schema(self) -> dict[str, Any]:
        """Return the tool's parameter schema."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to read.",
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Starting line number (1-based).",
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Ending line number (inclusive).",
                    },
                },
                "required": ["path"],
            },
        }


class FileWriteTool(BaseTool):
    """Tool for writing content to files.

    Creates or overwrites a file at the specified path
    with the given content.
    """

    def __init__(self) -> None:
        """Initialize the file write tool."""
        super().__init__(
            name="file_write",
            description="Write content to a file at the specified path.",
        )

    async def run(self, path: str, content: str) -> ToolResult:
        """Write content to a file.

        Args:
            path: Absolute path to the file.
            content: Content to write to the file.

        Returns:
            ToolResult indicating success or failure.
        """
        if not _is_path_allowed(path):
            return ToolResult(
                success=False,
                error=f"Access denied: path '{path}' is outside allowed directories",
            )

        content_size = len(content.encode('utf-8'))
        max_file_size = _get_max_file_size_bytes()
        if content_size > max_file_size:
            return ToolResult(
                success=False,
                error=f"Content too large: {content_size} bytes (max: {max_file_size} bytes)",
            )

        try:
            file_path = Path(path)
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Atomic write: temp file in the same directory, flush + fsync,
            # then os.replace so a crash can never leave a truncated file.
            tmp_path: str | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=file_path.parent,
                    prefix=".tmp-",
                    suffix=".tmp",
                    delete=False,
                ) as tmp_file:
                    tmp_path = tmp_file.name
                    tmp_file.write(content)
                    tmp_file.flush()
                    os.fsync(tmp_file.fileno())
                os.replace(tmp_path, file_path)
                tmp_path = None
            finally:
                if tmp_path is not None:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

            logger.info("Wrote file: %s (%d chars)", path, len(content))

            return ToolResult(
                success=True,
                output=f"Successfully wrote {len(content)} chars to {path}",
                metadata={"path": path, "size": len(content)},
            )

        except Exception as e:
            logger.error("Failed to write file %s: %s", path, str(e))
            return ToolResult(success=False, error=str(e))

    def get_schema(self) -> dict[str, Any]:
        """Return the tool's parameter schema."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to write.",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file.",
                    },
                },
                "required": ["path", "content"],
            },
        }
