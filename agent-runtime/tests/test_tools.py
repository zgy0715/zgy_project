"""Tests for agent tools."""

import os
import tempfile

import pytest

from app.tools.base import BaseTool, ToolResult
from app.tools.file_ops import FileReadTool, FileWriteTool
from app.tools.terminal import TerminalTool
from app.tools.git_ops import GitTool
from app.tools.code_search import CodeSearchTool
from app.tools.web_search import WebSearchTool


class TestToolResult:
    """Tests for the ToolResult dataclass."""

    def test_success_result(self) -> None:
        """Test creating a successful ToolResult."""
        result = ToolResult(success=True, output="Done")
        assert result.success is True
        assert result.output == "Done"
        assert result.error is None

    def test_error_result(self) -> None:
        """Test creating an error ToolResult."""
        result = ToolResult(success=False, error="Something went wrong")
        assert result.success is False
        assert result.error == "Something went wrong"
        assert result.output is None


class TestFileReadTool:
    """Tests for the FileReadTool."""

    @pytest.mark.asyncio
    async def test_read_existing_file(self) -> None:
        """Test reading an existing file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Hello, World!")
            temp_path = f.name

        try:
            tool = FileReadTool()
            result = await tool.run(path=temp_path)
            assert result.success is True
            assert "Hello, World!" in result.output
        finally:
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self) -> None:
        """Test reading a file that doesn't exist."""
        tool = FileReadTool()
        result = await tool.run(path="/nonexistent/file.txt")
        assert result.success is False
        assert "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_read_with_line_range(self) -> None:
        """Test reading a file with line range."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
            temp_path = f.name

        try:
            tool = FileReadTool()
            result = await tool.run(path=temp_path, start_line=2, end_line=4)
            assert result.success is True
            assert "Line 2" in result.output
            assert "Line 4" in result.output
        finally:
            os.unlink(temp_path)

    def test_get_schema(self) -> None:
        """Test that FileReadTool returns a valid schema."""
        tool = FileReadTool()
        schema = tool.get_schema()
        assert schema["name"] == "file_read"
        assert "path" in schema["parameters"]["properties"]


class TestFileWriteTool:
    """Tests for the FileWriteTool."""

    @pytest.mark.asyncio
    async def test_write_new_file(self) -> None:
        """Test writing to a new file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "test.txt")
            tool = FileWriteTool()
            result = await tool.run(path=file_path, content="Hello, World!")
            assert result.success is True

            # Verify the file was written
            with open(file_path) as f:
                assert f.read() == "Hello, World!"

    @pytest.mark.asyncio
    async def test_overwrite_existing_file(self) -> None:
        """Test overwriting an existing file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Old content")
            temp_path = f.name

        try:
            tool = FileWriteTool()
            result = await tool.run(path=temp_path, content="New content")
            assert result.success is True

            with open(temp_path) as f:
                assert f.read() == "New content"
        finally:
            os.unlink(temp_path)

    def test_get_schema(self) -> None:
        """Test that FileWriteTool returns a valid schema."""
        tool = FileWriteTool()
        schema = tool.get_schema()
        assert schema["name"] == "file_write"
        assert "path" in schema["parameters"]["properties"]
        assert "content" in schema["parameters"]["properties"]


class TestTerminalTool:
    """Tests for the TerminalTool."""

    @pytest.mark.asyncio
    async def test_execute_echo(self) -> None:
        """Test executing a simple echo command."""
        tool = TerminalTool()
        result = await tool.run(command="echo Hello")
        assert result.success is True
        assert "Hello" in result.output

    @pytest.mark.asyncio
    async def test_execute_failing_command(self) -> None:
        """Test executing a command that fails."""
        tool = TerminalTool()
        result = await tool.run(command="exit 1")
        assert result.success is False

    @pytest.mark.asyncio
    async def test_blocked_command(self) -> None:
        """Test that dangerous commands are blocked."""
        tool = TerminalTool()
        result = await tool.run(command="rm -rf /")
        assert result.success is False
        assert "blocked" in result.error.lower()

    @pytest.mark.asyncio
    async def test_command_timeout(self) -> None:
        """Test command timeout."""
        tool = TerminalTool(timeout=1)
        result = await tool.run(command="sleep 10", timeout=1)
        assert result.success is False
        assert "timed out" in result.error.lower()


class TestGitTool:
    """Tests for the GitTool."""

    def test_initialization(self) -> None:
        """Test GitTool initialization."""
        tool = GitTool()
        assert tool.name == "git"

    @pytest.mark.asyncio
    async def test_unknown_operation(self) -> None:
        """Test that unknown operations return an error."""
        tool = GitTool()
        result = await tool.run(operation="unknown")
        assert result.success is False
        assert "Unknown" in result.error

    @pytest.mark.asyncio
    async def test_commit_without_message(self) -> None:
        """Test that commit without message returns an error."""
        tool = GitTool()
        result = await tool.run(operation="commit", args={"message": ""})
        assert result.success is False


class TestCodeSearchTool:
    """Tests for the CodeSearchTool."""

    def test_initialization(self) -> None:
        """Test CodeSearchTool initialization."""
        tool = CodeSearchTool()
        assert tool.name == "code_search"

    def test_get_schema(self) -> None:
        """Test that CodeSearchTool returns a valid schema."""
        tool = CodeSearchTool()
        schema = tool.get_schema()
        assert "query" in schema["parameters"]["properties"]


class TestWebSearchTool:
    """Tests for the WebSearchTool."""

    def test_initialization(self) -> None:
        """Test WebSearchTool initialization."""
        tool = WebSearchTool()
        assert tool.name == "web_search"

    def test_get_schema(self) -> None:
        """Test that WebSearchTool returns a valid schema."""
        tool = WebSearchTool()
        schema = tool.get_schema()
        assert "query" in schema["parameters"]["properties"]
