"""Markdown document reading API endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Allowed base directories for reading markdown files
_ALLOWED_DIRS: list[Path] = [
    Path("/workspace"),
    Path("/app"),
]

# Allowed file extensions
_ALLOWED_EXTENSIONS = {".md", ".markdown", ".mdx"}


def _is_path_allowed(file_path: Path) -> bool:
    """Check if the file path is within allowed directories and not traversing."""
    try:
        resolved = file_path.resolve()
        return any(
            str(resolved).startswith(str(allowed.resolve()))
            for allowed in _ALLOWED_DIRS
        )
    except Exception:
        return False


@router.get("/{file_path:path}")
async def read_markdown_file(file_path: str) -> dict:
    """Read a markdown file and return its content.

    Args:
        file_path: Relative path to the markdown file.

    Returns:
        Dict with filename, content, and metadata.
    """
    path = Path(file_path)

    # Security: only allow markdown extensions
    if path.suffix.lower() not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension not allowed. Only {', '.join(_ALLOWED_EXTENSIONS)} are supported.",
        )

    # Security: prevent path traversal
    if not _is_path_allowed(path):
        raise HTTPException(
            status_code=403,
            detail="Access denied: file path is outside allowed directories.",
        )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="File not found.",
        )

    if not path.is_file():
        raise HTTPException(
            status_code=400,
            detail="Not a file.",
        )

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File is not valid UTF-8 text.",
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Permission denied reading file.",
        )
    except Exception as e:
        logger.error("Error reading file %s: %s", file_path, e)
        raise HTTPException(
            status_code=500,
            detail="Error reading file.",
        )

    # Extract title from first heading
    title = path.stem
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            title = line[2:].strip()
            break

    return {
        "filename": path.name,
        "path": str(path),
        "title": title,
        "content": content,
        "size_bytes": len(content.encode("utf-8")),
        "extension": path.suffix,
    }


@router.get("/")
async def list_markdown_files(
    directory: str = ".",
    recursive: bool = True,
) -> dict:
    """List all markdown files in a directory.

    Args:
        directory: Directory path to scan.
        recursive: Whether to scan subdirectories.

    Returns:
        Dict with list of markdown files found.
    """
    dir_path = Path(directory)

    if not _is_path_allowed(dir_path):
        raise HTTPException(
            status_code=403,
            detail="Access denied: directory is outside allowed directories.",
        )

    if not dir_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Directory not found.",
        )

    if not dir_path.is_dir():
        raise HTTPException(
            status_code=400,
            detail="Not a directory.",
        )

    files: list[dict] = []
    pattern = "**/*.md" if recursive else "*.md"
    for md_file in dir_path.glob(pattern):
        if md_file.is_file():
            # Extract title from first line heading
            title = md_file.stem
            try:
                first_lines = md_file.read_text(encoding="utf-8")[:500]
                for line in first_lines.split("\n"):
                    line = line.strip()
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
            except Exception:
                pass

            files.append({
                "filename": md_file.name,
                "path": str(md_file),
                "title": title,
                "size_bytes": md_file.stat().st_size,
            })

    # Also check .markdown and .mdx
    for ext in ["**/*.markdown" if recursive else "*.markdown", "**/*.mdx" if recursive else "*.mdx"]:
        for md_file in dir_path.glob(ext):
            if md_file.is_file():
                title = md_file.stem
                try:
                    first_lines = md_file.read_text(encoding="utf-8")[:500]
                    for line in first_lines.split("\n"):
                        line = line.strip()
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                except Exception:
                    pass

                files.append({
                    "filename": md_file.name,
                    "path": str(md_file),
                    "title": title,
                    "size_bytes": md_file.stat().st_size,
                })

    return {
        "directory": str(dir_path),
        "recursive": recursive,
        "count": len(files),
        "files": sorted(files, key=lambda f: f["path"]),
    }
