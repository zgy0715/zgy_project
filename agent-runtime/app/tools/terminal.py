﻿"""Terminal command execution tool."""

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
    # Package management
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
    # Fork bomb pattern
    re.compile(r":\(\)\s*\{", re.IGNORECASE),
    # Windows equivalents
    re.compile(r"^(format|del|erase|rd|deltree)$", re.IGNORECASE),
    re.compile(r"^(net\s+user|net\s+localgroup)$", re.IGNORECASE),
]

# Allowed commands — read-only and development-safe commands only.
# Compilers (gcc, javac, rustc), build tools (mvn, gradle, cargo, go),
# and runtimes (java, python) have been removed because they can
# download and/or execute arbitrary code, bypassing file operation controls.
ALLOWED_COMMANDS: list[str] = [
    # File inspection (read-only)
    "ls", "find", "cat", "head", "tail", "less", "more", "wc",
    "file", "stat", "tree", "du", "df",
    # Text processing
    "grep", "egrep", "fgrep", "rg", "ack",
    "sort", "uniq", "cut", "tr", "tee",
    "diff", "comm", "paste", "column",
    # Version control
    "git",
    # Testing frameworks (run pre-existing tests only)
    "pytest", "unittest", "jest", "vitest",
    # Process info (read-only)
    "ps", "top", "htop", "which", "whereis", "env", "printenv",
    "echo", "pwd", "whoami", "hostname", "uname", "date",
    # Network info (read-only)
    "ping", "host", "dig", "nslookup", "ifconfig", "ip",
    # Compression (list/extract only)
    "tar", "unzip", "gunzip", "zcat",
    # Build system (safe: requires existing build infrastructure)
    "make", "cmake",
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
    first_segment = re.split(r"[|;&]|\|\||&&", stripped, maxsplit=1)[0].strip()

    # Try shlex split for proper tokenization
    try:
        tokens = shlex.split(first_segment)
    except ValueError:
        # Fallback: simple whitespace split
        tokens = first_segment.split()

    if not tokens:
        return ""

    # Get the basename of the command (handle paths like /usr/bin/grep)
    cmd = tokens[0]
    cmd_name = cmd.split("/")[-1].split("\\")[-1] if cmd else ""

    return cmd_name.lower()


class TerminalTool(BaseTool):
    """Tool for executing terminal commands.

    Provides controlled command execution with security checks:
    1. Whitelist-based command filtering
    2. Pattern-based dangerous command blocking
    3. Working directory restriction
    4. Execution timeout enforcement
    5. Shell syntax injection prevention
    """

    def __init__(self) -> None:
        """Initialize the terminal tool."""
        super().__init__(
            name="terminal",
            description="Execute a terminal command in a controlled environment.",
        )
        self._settings = None

    @property
    def settings(self):
        """Lazy-load settings."""
        if self._settings is None:
            self._settings = get_settings()
        return self._settings

    async def run(
        self,
        command: str,
        cwd: str | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> ToolResult:
        """Execute a terminal command with security checks.

        Args:
            command: The command to execute.
            cwd: Working directory for execution.
            timeout: Maximum execution time in seconds.

        Returns:
            ToolResult with command output.
        """
        # Check if shell execution is globally enabled
        if not self.settings.security.allow_shell:
            return ToolResult(
                success=False,
                error="Shell execution is disabled by administrator",
            )

        # Security check: is the command safe?
        if not self._is_command_safe(command):
            return ToolResult(
                success=False,
                error="Command rejected by security policy",
            )

        # Resolve working directory
        exec_cwd = cwd or self.settings.security.allowed_directories[0] if self.settings.security.allowed_directories else "/tmp"
        if cwd and not self._is_cwd_allowed(cwd):
            return ToolResult(
                success=False,
                error=f"Working directory '{cwd}' is outside allowed directories",
            )

        exec_timeout = min(timeout, DEFAULT_TIMEOUT)

        try:
            # Use asyncio subprocess for execution
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=exec_cwd,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=exec_timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                logger.warning("Command timed out: %s", command[:100])
                return ToolResult(
                    success=False,
                    error=f"Command timed out after {exec_timeout}s",
                )

            exit_code = process.returncode or 0
            output = (stdout.decode("utf-8", errors="replace") if stdout else "") + \
                     (stderr.decode("utf-8", errors="replace") if stderr else "")

            logger.info(
                "Command executed (exit=%d): %s",
                exit_code,
                command[:100],
            )

            return ToolResult(
                success=exit_code == 0,
                output=output if exit_code == 0 else f"Exit code {exit_code}:\n{output}",
                metadata={
                    "command": command,
                    "exit_code": exit_code,
                    "timeout": exec_timeout,
                },
            )

        except Exception as e:
            logger.error("Command execution failed: %s - %s", command[:100], str(e))
            return ToolResult(success=False, error=str(e))

    def _is_cwd_allowed(self, cwd: str) -> bool:
        """Check if the working directory is within allowed directories."""
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

        Uses a four-layer defense:
        0. Reject dangerous shell syntax patterns (command substitution, etc.)
        1. Extract base command and verify against whitelist
        2. Check full command string against dangerous regex patterns
        3. Inspect all pipe segments for dangerous sub-commands

        Args:
            command: The command string to check.

        Returns:
            True if the command appears safe, False otherwise.
        """
        # Layer 0: Reject dangerous shell syntax patterns
        dangerous_patterns = [
            (r'\$\(', "command substitution $(...)"),
            (r'`', "backtick command substitution"),
            (r'\$\{', "parameter expansion ${...}"),
            (r'>>', "append redirect"),
        ]
        for pattern, description in dangerous_patterns:
            if re.search(pattern, command):
                logger.warning(
                    "Command rejected (forbidden pattern '%s'): %s",
                    description,
                    command[:100],
                )
                return False

        # Layer 1: Check each pipe/chain segment
        segments = re.split(r"[|;&]|\|\||&&", command)
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
