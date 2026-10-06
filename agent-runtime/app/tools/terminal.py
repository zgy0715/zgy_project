"""Terminal command execution tool."""

import asyncio
import logging
import os
import re
import shlex
import signal
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
# Commands that can spawn another program or write outside the sandbox
# themselves are also excluded: `find` (-exec/-delete), `tar` (--to-command),
# `make`/`cmake` (recipes), `env`/`printenv` (execute a command and dump the
# process environment, including secrets) and `tee` (writes to arbitrary
# paths, bypassing the file operation controls).
ALLOWED_COMMANDS: list[str] = [
    # File inspection (read-only)
    "ls", "cat", "head", "tail", "wc",
    "file", "stat", "tree", "du", "df",
    # Text processing
    "grep", "egrep", "fgrep", "rg", "ack",
    "sort", "uniq", "cut", "tr",
    "diff", "comm", "paste", "column",
    # Version control
    "git",
    # Testing frameworks (run pre-existing tests only)
    "pytest", "unittest", "jest", "vitest",
    # Process info (read-only)
    "ps", "which", "whereis",
    "echo", "pwd", "whoami", "hostname", "uname", "date", "sleep",
    # Network info (read-only)
    "ping", "host", "dig", "nslookup", "ifconfig", "ip",
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
    1. No shell is ever involved: the command is tokenized with ``shlex`` and
       the process is started with ``create_subprocess_exec``, so shell
       operators (``;``, ``&&``, ``|``, redirections, substitutions) can never
       execute — they are rejected before reaching a process.
    2. Whitelist-based command filtering on the real ``argv[0]``
    3. Pattern-based dangerous command blocking
    4. Per-command argument guards for programs that can spawn another program
    5. Working directory restriction
    6. Execution timeout enforcement and bounded output
    """

    #: Hard cap on the combined stdout+stderr captured from a command.
    MAX_OUTPUT_BYTES = 1024 * 1024

    #: Characters that are rejected outright. Without a shell they would be
    #: passed through as literal arguments, but rejecting them keeps
    #: "shell-flavoured" input from ever being interpreted by a downstream
    #: program (for example ``find``/``tar`` argument injection).
    FORBIDDEN_CHARS: tuple[str, ...] = ("|", "&", ";", "`", "$", "\n", "\r", ">", "<")

    #: Arguments rejected per command because that program can itself execute
    #: another program or write outside the working directory, independently of
    #: any shell.
    FORBIDDEN_ARGS: dict[str, tuple[str, ...]] = {
        "find": ("-exec", "-execdir", "-ok", "-okdir", "-delete", "-fprintf", "-fls"),
        "tar": (
            "--to-command",
            "--checkpoint-action",
            "--use-compress-program",
            "-C",
            "--directory",
        ),
        "unzip": ("-d",),
        "less": ("-k", "--lessopen"),
    }

    #: Read-only git subcommands. Subcommands such as ``difftool``, ``help``,
    #: ``filter-branch`` or ``bisect`` run other programs, and aliases/hooks can
    #: execute arbitrary code.
    ALLOWED_GIT_SUBCOMMANDS: frozenset[str] = frozenset({
        "status", "log", "diff", "show", "branch", "rev-parse", "ls-files",
        "ls-tree", "describe", "blame", "grep", "shortlog", "whatchanged",
        "cat-file", "show-ref", "rev-list", "name-rev", "symbolic-ref",
    })

    def __init__(self, timeout: int = DEFAULT_TIMEOUT) -> None:
        """Initialize the terminal tool.

        Args:
            timeout: Default execution timeout in seconds. Capped at
                ``DEFAULT_TIMEOUT`` and floored at 1 second.
        """
        super().__init__(
            name="terminal",
            description="Execute a terminal command in a controlled environment.",
        )
        self._settings = None
        self._default_timeout = max(1, min(int(timeout), DEFAULT_TIMEOUT))

    @property
    def settings(self):
        """Lazy-load settings."""
        if self._settings is None:
            self._settings = get_settings()
        return self._settings

    @property
    def default_timeout(self) -> int:
        """Return the default execution timeout in seconds."""
        return self._default_timeout

    async def run(
        self,
        command: str,
        cwd: str | None = None,
        timeout: int | None = None,
    ) -> ToolResult:
        """Execute a terminal command with security checks.

        The command is tokenized and executed without a shell, so no shell
        metacharacter is ever interpreted.

        Args:
            command: The command to execute.
            cwd: Working directory for execution (must be inside an allowed
                directory).
            timeout: Maximum execution time in seconds. Defaults to the
                instance timeout, capped at ``DEFAULT_TIMEOUT``.

        Returns:
            ToolResult with command output.
        """
        # Check if command execution is globally enabled
        if not self.settings.security.allow_shell:
            return ToolResult(
                success=False,
                error="Command execution is disabled by administrator",
            )

        # Security check: parse and validate the command into a real argv
        argv = self._parse_command(command)
        if argv is None:
            return ToolResult(
                success=False,
                error="Command blocked by security policy",
            )

        # Resolve the working directory, failing closed when nothing is allowed
        allowed_dirs = self.settings.security.allowed_directories
        if not allowed_dirs:
            logger.warning("No allowed directories configured — denying command execution")
            return ToolResult(
                success=False,
                error="No allowed directories configured",
            )

        exec_cwd = cwd or allowed_dirs[0]
        if not self._is_cwd_allowed(exec_cwd):
            return ToolResult(
                success=False,
                error=f"Working directory '{exec_cwd}' is outside allowed directories",
            )

        if timeout is None:
            exec_timeout = self._default_timeout
        else:
            exec_timeout = max(1, min(int(timeout), DEFAULT_TIMEOUT))

        # ``echo`` and ``sleep`` are shell builtins rather than executables, so
        # there is no echo.exe/sleep.exe to exec on Windows. They are served
        # in-process instead of re-enabling a shell, which keeps the no-shell
        # guarantee intact while making the whitelist portable.
        builtin_result = await self._run_builtin(argv, exec_timeout, command)
        if builtin_result is not None:
            return builtin_result

        try:
            # Execute without a shell: argv is passed straight to exec, so
            # shell syntax can never be interpreted.
            process = await asyncio.create_subprocess_exec(
                *argv,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                # Never inherit the server's stdin: no child may read from it.
                stdin=asyncio.subprocess.DEVNULL,
                cwd=exec_cwd,
                # Own process group so a timeout can kill the whole tree.
                start_new_session=True,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=exec_timeout
                )
            except asyncio.TimeoutError:
                await self._kill_process_tree(process)
                logger.warning("Command timed out: %s", " ".join(argv)[:100])
                return ToolResult(
                    success=False,
                    error=f"Command timed out after {exec_timeout}s",
                )

            exit_code = process.returncode or 0
            raw_output = (stdout or b"") + (stderr or b"")
            truncated = len(raw_output) > self.MAX_OUTPUT_BYTES
            if truncated:
                raw_output = raw_output[: self.MAX_OUTPUT_BYTES]
            output = raw_output.decode("utf-8", errors="replace")
            if truncated:
                output += f"\n... output truncated at {self.MAX_OUTPUT_BYTES} bytes"

            logger.info(
                "Command executed (exit=%d): %s",
                exit_code,
                " ".join(argv)[:100],
            )

            return ToolResult(
                success=exit_code == 0,
                output=output if exit_code == 0 else f"Exit code {exit_code}:\n{output}",
                metadata={
                    "command": command,
                    "argv": argv,
                    "exit_code": exit_code,
                    "timeout": exec_timeout,
                    "truncated": truncated,
                },
            )

        except FileNotFoundError:
            logger.warning("Command not found: %s", argv[0])
            return ToolResult(success=False, error=f"Command not found: {argv[0]}")
        except Exception as e:
            logger.error("Command execution failed: %s - %s", " ".join(argv)[:100], str(e))
            return ToolResult(success=False, error=str(e))

    async def _run_builtin(
        self,
        argv: list[str],
        exec_timeout: int,
        command: str,
    ) -> ToolResult | None:
        """Serve the whitelisted shell builtins without spawning a process.

        ``echo`` and ``sleep`` are builtins, not executables, so handing them to
        ``create_subprocess_exec`` fails with "Command not found" on Windows.

        Args:
            argv: The validated argument vector.
            exec_timeout: The effective timeout in seconds.
            command: The original command string (for metadata).

        Returns:
            A ToolResult for a supported builtin, otherwise ``None`` so the
            caller executes the command as a normal subprocess.
        """
        metadata = {
            "command": command,
            "argv": argv,
            "timeout": exec_timeout,
            "truncated": False,
            "builtin": True,
        }

        if argv[0] == "echo":
            return ToolResult(
                success=True,
                output=" ".join(argv[1:]),
                metadata={**metadata, "exit_code": 0},
            )

        if argv[0] == "sleep":
            if len(argv) > 1:
                try:
                    seconds = float(argv[1])
                except ValueError:
                    return ToolResult(
                        success=False,
                        error=f"Invalid sleep duration: {argv[1]}",
                    )
            else:
                seconds = 1.0

            if seconds < 0:
                return ToolResult(success=False, error="Invalid sleep duration")

            if seconds >= exec_timeout:
                # Mirror the subprocess timeout path: wait out the budget, then
                # report the same timeout error the killed process would cause.
                await asyncio.sleep(exec_timeout)
                logger.warning("Command timed out: %s", " ".join(argv)[:100])
                return ToolResult(
                    success=False,
                    error=f"Command timed out after {exec_timeout}s",
                )

            await asyncio.sleep(seconds)
            return ToolResult(
                success=True,
                output="",
                metadata={**metadata, "exit_code": 0},
            )

        return None

    @staticmethod
    async def _kill_process_tree(process: asyncio.subprocess.Process) -> None:
        """Kill the process group started for ``process``.

        ``process.kill()`` only signals the direct child; grandchildren started
        by that child would keep running. The process is started in its own
        session (``start_new_session=True``), so the whole group can be killed.
        """
        try:
            if process.returncode is None:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError) as exc:
            logger.warning("Falling back to killing the direct child only: %s", exc)
            try:
                process.kill()
            except ProcessLookupError:
                pass
        finally:
            try:
                await process.wait()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Failed to reap killed process: %s", exc)

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

    def _parse_command(self, command: str) -> list[str] | None:
        """Validate a command string and return its argv, or None if blocked.

        Because the command is executed without a shell, this is the single gate
        that decides whether a command may run:

        0. Reject shell metacharacters and control characters outright, so no
           downstream program can ever be handed shell syntax.
        1. Tokenize with ``shlex`` — nothing is interpreted by a shell.
        2. Verify ``argv[0]`` against the whitelist and rewrite it to the bare
           name, so ``/tmp/ls`` cannot masquerade as ``ls``.
        3. Reject per-command arguments that can themselves spawn another
           program or write outside the working directory.
        4. Restrict ``git`` to read-only subcommands.
        5. Check the base command name and the full string against the blocked
           pattern blacklist.

        Args:
            command: The command string to check.

        Returns:
            The validated argv when the command is safe, otherwise ``None``.
        """
        if not command or not command.strip():
            return None

        # Layer 0: reject characters that only make sense in a shell, plus
        # control characters, as well as any argument injection vector.
        for char in self.FORBIDDEN_CHARS:
            if char in command:
                logger.warning(
                    "Command rejected (forbidden character %r): %s", char, command[:100]
                )
                return None

        # Layer 1: tokenize the command (no shell is involved at any point)
        try:
            argv = shlex.split(command)
        except ValueError as exc:
            logger.warning(
                "Command rejected (unparseable quoting): %s - %s", command[:100], exc
            )
            return None

        if not argv:
            return None

        # Layer 2: whitelist check against the real executable name
        base_cmd = os.path.basename(argv[0]).lower()
        if base_cmd not in [cmd.lower() for cmd in ALLOWED_COMMANDS]:
            logger.warning(
                "Command rejected (not in whitelist): '%s' from '%s'",
                base_cmd,
                command[:80],
            )
            return None
        # Run the bare name so a path cannot masquerade as a whitelisted tool.
        argv[0] = base_cmd

        # Layer 3: per-command argument guards
        forbidden_args = self.FORBIDDEN_ARGS.get(base_cmd, ())
        for arg in argv[1:]:
            for forbidden in forbidden_args:
                if arg == forbidden or arg.startswith(f"{forbidden}="):
                    logger.warning(
                        "Command rejected (forbidden argument '%s' for '%s'): %s",
                        forbidden,
                        base_cmd,
                        command[:100],
                    )
                    return None

        # Layer 4: git may only run read-only subcommands (subcommands such as
        # difftool/help/filter-branch run other programs, and aliases/hooks can
        # execute arbitrary code)
        if base_cmd == "git":
            subcommand = next((arg for arg in argv[1:] if not arg.startswith("-")), None)
            if subcommand is None:
                logger.warning("Command rejected (git without subcommand): %s", command[:100])
                return None
            if subcommand.lower() not in self.ALLOWED_GIT_SUBCOMMANDS:
                logger.warning(
                    "Command rejected (git subcommand '%s' is not read-only): %s",
                    subcommand,
                    command[:100],
                )
                return None

        # Layer 5: regex blacklist against the base command name and the full
        # command string
        for pattern in BLOCKED_COMMAND_PATTERNS:
            if pattern.search(base_cmd) or pattern.search(command):
                logger.warning(
                    "Command rejected (matched blocked pattern '%s'): %s",
                    pattern.pattern,
                    command[:100],
                )
                return None

        return argv

    def _is_command_safe(self, command: str) -> bool:
        """Check whether a command passes all validation layers.

        Backwards-compatible wrapper around :meth:`_parse_command`.

        Args:
            command: The command string to check.

        Returns:
            True if the command appears safe, False otherwise.
        """
        return self._parse_command(command) is not None

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
