"""Terminal command execution tool."""

import asyncio
import logging
import re
import shlex
from typing import Any

from app.config import get_settings
from app.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)

# Maximum execution time in seconds
DEFAULT_TIMEOUT = 60

# Dangerous command patterns — matched against the base command name
# after extracting it from the full command string.
BLOCKED_COMMAND_PATTERNS: list[re.Pattern[str]] = [
    # Filesystem destruction
    re.compile(r"^(rm|rmdir)$", re.IGNORECASE),
    re.compile(r"^(mkfs\..*|mkfs)$", re.IGNORECASE),
    re.compile(r"^(dd)$", re.IGNORECASE),
    re.compile(r"^(shred)$", re.IGNORECASE),
    re.compile(r"^(truncate)$", re.IGNORECASE),
    # Disk/partition
    re.compile(r"^(fdisk|parted|mkpart|cfdisk|gdisk)$", re.IGNORECASE),
    # Permission/ownership
    re.compile(r"^(chmod|chown|chgrp)$", re.IGNORECASE),
    # User/system management
    re.compile(r"^(useradd|userdel|usermod|adduser|deluser)$", re.IGNORECASE),
    re.compile(r"^(groupadd|groupdel|groupmod)$", re.IGNORECASE),
    re.compile(r"^(passwd|shadow)$", re.IGNORECASE),
    # System control
    re.compile(r"^(shutdown|reboot|halt|poweroff|init)$", re.IGNORECASE),
    re.compile(r"^(systemctl)$", re.IGNORECASE),
    re.compile(r"^(service)$", re.IGNORECASE),
    # Package management (prevent uncontrolled installs)
    re.compile(r"^(apt|apt-get|aptitude|yum|dnf|pacman|emerge|nix-env)$", re.IGNORECASE),
    re.compile(r"^(pip|pip3|conda|npm|yarn|pnpm|cargo install)$", re.IGNORECASE),
    # Network download/execute
    re.compile(r"^(curl|wget)$", re.IGNORECASE),
    re.compile(r"^(nc|ncat|netcat)$", re.IGNORECASE),
    # Shell/eval — arbitrary code execution
    re.compile(r"^(bash|sh|zsh|csh|tcsh|ksh|fish|dash)$", re.IGNORECASE),
    re.compile(r"^(eval|exec|source)$", re.IGNORECASE),
    # Sudo/elevated
    re.compile(r"^(sudo|su|doas|run0)$", re.IGNORECASE),
    # Cron/daemon persistence
    re.compile(r"^(crontab|at|batch)$", re.IGNORECASE),
    # Kernel/module
    re.compile(r"^(modprobe|insmod|rmmod|lsmod)$", re.IGNORECASE),
    re.compile(r"^(sysctl)$", re.IGNORECASE),
    # I/O redirection to critical paths
    re.compile(r">\s*/etc/", re.IGNORECASE),
    re.compile(r">\s*/boot/", re.IGNORECASE),
    re.compile(r">\s*/usr/", re.IGNORECASE),
    re.compile(r">\s*/bin/", re.IGNORECASE),
    re.compile(r">\s*/sbin/", re.IGNORECASE),
    # Fork bomb pattern
    re.compile(r":\(\)\s*\{", re.IGNORECASE),
    # Windows equivalents
    re.compile(r"^(format|del|erase|rd|deltree)$", re.IGNORECASE),
    re.compile(r"^(net\s+user|net\s+localgroup)$", re.IGNORECASE),
]

# Allowed commands — only these base commands can be executed.
# If non-empty, any command NOT in this list is blocked.
ALLOWED_COMMANDS: list[str] = [
    # File inspection (read-only)
    "ls", "find", "cat", "head", "tail", "less", "more", "wc",
    "file", "stat", "tree", "du", "df",
    # Text processing
    "grep", "egrep", "fgrep", "rg", "ack",
    "awk", "sed", "sort", "uniq", "cut", "tr", "tee",
    "diff", "comm", "paste", "column",
    # Development
    "git", "python", "python3", "node", "npm", "npx",
    "java", "javac", "mvn", "gradle", "go", "cargo", "rustc",
    "make", "cmake", "gcc", "g++", "clang", "clang++",
    "pytest", "unittest", "jest", "vitest",
    # Process info
    "ps", "top", "htop", "which", "whereis", "env", "printenv",
    "echo", "pwd", "whoami", "hostname", "uname", "date",
    # Network info (read-only)
    "ping", "host", "dig", "nslookup", "ifconfig", "ip",
    # Compression (list/extract only)
    "tar", "unzip", "gunzip", "zcat",
]


def _extract_base_command(command: str) -> str:
    """Extract the base command name from a command string.

    Handles pipes, redirections, subshells, and environment variable
    assignments by extracting the first actual command token.

    Args:
        command: The full command string.

    Returns:
        The base command name (lowercase).
    """
    # Strip leading whitespace and common prefixes
    stripped = command.strip()

    # Remove environment variable assignments (VAR=value cmd ...)
    while True:
        match = re.match(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s*", stripped)
        if match:
            stripped = stripped[match.end():]
        else:
            break

    # Remove subshell/ grouping
    stripped = stripped.lstrip("( ")

    # Handle pipe chains — check each segment
    # For now, extract the very first command
    first_segment = re.split(r"[|;&]", stripped, maxsplit=1)[0].strip()

    # Try shlex split for proper tokenization
    try:
        tokens = shlex.split(first_segment)
    except ValueError:
        # Fallback: simple whitespace split
        tokens = first_segment.split()

    if not tokens:
        return ""

    # Get the basename of the command path (e.g., /usr/bin/git -> git)
    base = tokens[0].rsplit("/", maxsplit=1)[-1].lower()
    return base


class TerminalTool(BaseTool):
    """Tool for executing terminal commands safely.

    Runs shell commands in a subprocess with timeout and output
    capture. Uses a whitelist + blacklist approach for safety:
    - Global kill switch via SECURITY_ALLOW_SHELL config
    - Whitelist of allowed base commands
    - Blacklist of dangerous patterns (regex-based)
    """

    def __init__(self, timeout: int = DEFAULT_TIMEOUT) -> None:
        """Initialize the terminal tool.

        Args:
            timeout: Maximum execution time in seconds.
        """
        super().__init__(
            name="terminal",
            description="Execute a terminal command and return the output.",
        )
        self.timeout = timeout

    async def run(
        self,
        command: str,
        cwd: str | None = None,
        timeout: int | None = None,
    ) -> ToolResult:
        """Execute a terminal command.

        Args:
            command: The command string to execute.
            cwd: Working directory for command execution.
            timeout: Override default timeout in seconds.

        Returns:
            ToolResult with stdout, stderr, and exit code.
        """
        # Global kill switch: check if shell execution is allowed
        settings = get_settings()
        if not settings.security.allow_shell:
            return ToolResult(
                success=False,
                error="Shell execution is disabled by security policy (SECURITY_ALLOW_SHELL=false)",
            )

        # Validate working directory is within allowed directories
        if cwd is not None and not self._is_cwd_allowed(cwd):
            return ToolResult(
                success=False,
                error=f"Access denied: working directory '{cwd}' is outside allowed directories",
            )

        # Safety check
        if not self._is_command_safe(command):
            return ToolResult(
                success=False,
                error=f"Command blocked for safety: {command}",
            )

        exec_timeout = timeout or self.timeout

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=exec_timeout,
            )

            stdout_str = stdout.decode("utf-8", errors="replace")
            stderr_str = stderr.decode("utf-8", errors="replace")
            exit_code = process.returncode or 0

            logger.info(
                "Command executed: %s (exit_code=%d)",
                command[:100],
                exit_code,
            )

            output_parts: list[str] = []
            if stdout_str:
                output_parts.append(stdout_str)
            if stderr_str:
                output_parts.append(f"[stderr]\n{stderr_str}")

            return ToolResult(
                success=exit_code == 0,
                output="\n".join(output_parts),
                error=stderr_str if exit_code != 0 else None,
                metadata={
                    "command": command,
                    "exit_code": exit_code,
                    "timeout": exec_timeout,
                },
            )

        except asyncio.TimeoutError:
            logger.warning("Command timed out: %s", command[:100])
            return ToolResult(
                success=False,
                error=f"Command timed out after {exec_timeout}s",
            )

        except Exception as e:
            logger.error("Command execution failed: %s - %s", command[:100], str(e))
            return ToolResult(success=False, error=str(e))

    def _is_cwd_allowed(self, cwd: str) -> bool:
        """Check if the working directory is within allowed directories.

        Reuses the same SecurityConfig.allowed_directories as file_ops
        to ensure agents cannot execute commands outside the workspace.

        Args:
            cwd: The working directory path to check.

        Returns:
            True if the directory is allowed, False otherwise.
        """
        from pathlib import Path

        settings = get_settings()
        allowed_dirs = settings.security.allowed_directories

        if not allowed_dirs:
            logger.warning("No allowed directories configured — denying cwd access")
            return False

        resolved = Path(cwd).resolve()
        return any(
            resolved.is_relative_to(Path(allowed).resolve())
            for allowed in allowed_dirs
        )

    def _is_command_safe(self, command: str) -> bool:
        """Check if a command is safe to execute.

        Uses a three-layer defense:
        1. Extract base command and verify against whitelist
        2. Check full command string against dangerous regex patterns
        3. Inspect all pipe segments for dangerous sub-commands

        Args:
            command: The command string to check.

        Returns:
            True if the command appears safe, False otherwise.
        """
        # Layer 1: Check each pipe/chain segment
        segments = re.split(r"[|;&]", command)
        for segment in segments:
            base_cmd = _extract_base_command(segment)

            if not base_cmd:
                continue

            # Whitelist check
            if base_cmd not in [cmd.lower() for cmd in ALLOWED_COMMANDS]:
                logger.warning(
                    "Command rejected (not in whitelist): '%s' from segment '%s'",
                    base_cmd,
                    segment.strip()[:80],
                )
                return False

        # Layer 2: Regex blacklist on the full command string
        for pattern in BLOCKED_COMMAND_PATTERNS:
            if pattern.search(command):
                logger.warning(
                    "Command rejected (matched blocked pattern '%s'): %s",
                    pattern.pattern,
                    command[:100],
                )
                return False

        # Layer 3: Reject commands with suspicious redirection to critical paths
        if re.search(r">\s*/(etc|boot|usr|bin|sbin|dev|proc|sys)/", command, re.IGNORECASE):
            logger.warning("Command rejected (writes to critical path): %s", command[:100])
            return False

        return True

    def get_schema(self) -> dict[str, Any]:
        """Return the tool's parameter schema."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The terminal command to execute.",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory for command execution.",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds.",
                    },
                },
                "required": ["command"],
            },
        }
