"""Code parsing utilities using AST analysis."""

import ast
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FunctionInfo:
    """Information about a parsed function.

    Attributes:
        name: Function name.
        args: List of argument names.
        return_type: Return type annotation string.
        docstring: Function docstring.
        line_start: Starting line number.
        line_end: Ending line number.
        decorators: List of decorator names.
    """

    name: str
    args: list[str] = field(default_factory=list)
    return_type: str | None = None
    docstring: str | None = None
    line_start: int = 0
    line_end: int = 0
    decorators: list[str] = field(default_factory=list)


@dataclass
class ClassInfo:
    """Information about a parsed class.

    Attributes:
        name: Class name.
        bases: List of base class names.
        methods: List of method FunctionInfo objects.
        docstring: Class docstring.
        line_start: Starting line number.
        line_end: Ending line number.
    """

    name: str
    bases: list[str] = field(default_factory=list)
    methods: list[FunctionInfo] = field(default_factory=list)
    docstring: str | None = None
    line_start: int = 0
    line_end: int = 0


@dataclass
class ModuleInfo:
    """Information about a parsed Python module.

    Attributes:
        path: File path.
        functions: List of top-level function info.
        classes: List of class info.
        imports: List of import statements.
        docstring: Module docstring.
        total_lines: Total number of lines.
    """

    path: str
    functions: list[FunctionInfo] = field(default_factory=list)
    classes: list[ClassInfo] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    docstring: str | None = None
    total_lines: int = 0


class CodeParser:
    """Parser for Python source code using AST analysis.

    Extracts structural information from Python files including
    functions, classes, imports, and their metadata.

    Example:
        >>> parser = CodeParser()
        >>> module_info = parser.parse_file("app/main.py")
        >>> for func in module_info.functions:
        ...     print(func.name, func.args)
    """

    def parse_file(self, file_path: str) -> ModuleInfo:
        """Parse a Python file and extract structural information.

        Args:
            file_path: Path to the Python file.

        Returns:
            ModuleInfo with parsed structure.

        Raises:
            FileNotFoundError: If the file does not exist.
            SyntaxError: If the file contains syntax errors.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        source = path.read_text(encoding="utf-8")
        return self.parse_source(source, file_path=str(path))

    def parse_source(self, source: str, file_path: str = "<string>") -> ModuleInfo:
        """Parse Python source code and extract structural information.

        Args:
            source: Python source code string.
            file_path: Optional file path for reference.

        Returns:
            ModuleInfo with parsed structure.

        Raises:
            SyntaxError: If the source contains syntax errors.
        """
        tree = ast.parse(source, filename=file_path)
        lines = source.splitlines()

        module_info = ModuleInfo(
            path=file_path,
            total_lines=len(lines),
            docstring=ast.get_docstring(tree),
        )

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module_info.imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module_name = node.module or ""
                for alias in node.names:
                    module_info.imports.append(f"{module_name}.{alias.name}")
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                module_info.functions.append(self._parse_function(node))
            elif isinstance(node, ast.ClassDef):
                module_info.classes.append(self._parse_class(node))

        return module_info

    def _parse_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> FunctionInfo:
        """Parse a function definition node.

        Args:
            node: AST function definition node.

        Returns:
            FunctionInfo with function details.
        """
        args = [
            arg.arg for arg in node.args.args
            if arg.arg != "self"
        ]

        return_type = None
        if node.returns:
            return_type = ast.unparse(node.returns)

        decorators = []
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name):
                decorators.append(decorator.id)
            elif isinstance(decorator, ast.Attribute):
                decorators.append(ast.unparse(decorator))

        return FunctionInfo(
            name=node.name,
            args=args,
            return_type=return_type,
            docstring=ast.get_docstring(node),
            line_start=node.lineno,
            line_end=node.end_lineno or node.lineno,
            decorators=decorators,
        )

    def _parse_class(self, node: ast.ClassDef) -> ClassInfo:
        """Parse a class definition node.

        Args:
            node: AST class definition node.

        Returns:
            ClassInfo with class details.
        """
        bases = []
        for base in node.bases:
            if isinstance(base, ast.Name):
                bases.append(base.id)
            elif isinstance(base, ast.Attribute):
                bases.append(ast.unparse(base))

        methods = []
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                methods.append(self._parse_function(item))

        return ClassInfo(
            name=node.name,
            bases=bases,
            methods=methods,
            docstring=ast.get_docstring(node),
            line_start=node.lineno,
            line_end=node.end_lineno or node.lineno,
        )

    def extract_symbols(self, source: str) -> list[str]:
        """Extract all symbol names (functions, classes) from source code.

        Args:
            source: Python source code string.

        Returns:
            List of symbol name strings.
        """
        tree = ast.parse(source)
        symbols: list[str] = []

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                symbols.append(node.name)
            elif isinstance(node, ast.ClassDef):
                symbols.append(node.name)
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        symbols.append(f"{node.name}.{item.name}")

        return symbols
