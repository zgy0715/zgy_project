"""Markdown document reading API endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Allowed file extensions
_ALLOWED_EXTENSIONS = (".md", ".markdown", ".mdx")


def _allowed_dirs() -> list[Path]:
    """Return the configured allowed base directories, resolved.

    Uses ``SECURITY_ALLOWED_DIRECTORIES`` so the sandbox boundary is defined in
    exactly one place, and fails closed: an empty configuration allows nothing.
    """
    allowed: list[Path] = []
    for raw in get_settings().security.allowed_directories:
        try:
            allowed.append(Path(raw).resolve())
        except OSError:
            logger.warning("Ignoring unusable allowed directory: %s", raw)
    return allowed


def _max_file_size_bytes() -> int:
    """Return the configured maximum readable file size in bytes."""
    return get_settings().security.max_file_size_mb * 1024 * 1024


def _is_path_allowed(file_path: Path) -> bool:
    """Check if the file path is within allowed directories and not traversing."""
    allowed_dirs = _allowed_dirs()
    if not allowed_dirs:
        logger.warning("No allowed directories configured — denying document access")
        return False

    try:
        resolved = file_path.resolve()
    except OSError:
        return False

    # is_relative_to() compares whole path components, so a sibling directory
    # such as /workspace-evil no longer passes for the allowed /workspace.
    return any(resolved.is_relative_to(allowed) for allowed in allowed_dirs)


def _extract_title(path: Path, content: str) -> str:
    """Extract the document title from the first level-1 heading."""
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem


@router.get("/")
async def list_markdown_files(
    directory: str | None = None,
    recursive: bool = True,
) -> dict:
    """List all markdown files in a directory.

    Args:
        directory: Directory path to scan. Defaults to the first configured
            allowed directory.
        recursive: Whether to scan subdirectories.

    Returns:
        Dict with list of markdown files found.
    """
    if directory is None:
        allowed_dirs = _allowed_dirs()
        if not allowed_dirs:
            raise HTTPException(
                status_code=403,
                detail="Access denied: no allowed directories are configured.",
            )
        dir_path = allowed_dirs[0]
    else:
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

    max_size = _max_file_size_bytes()
    files: list[dict] = []
    seen: set[Path] = set()

    for extension in _ALLOWED_EXTENSIONS:
        pattern = f"**/*{extension}" if recursive else f"*{extension}"
        for md_file in dir_path.glob(pattern):
            if not md_file.is_file():
                continue
            resolved = md_file.resolve()
            if resolved in seen or not _is_path_allowed(resolved):
                continue
            seen.add(resolved)

            # Extract title from the beginning of the file only
            title = md_file.stem
            try:
                if resolved.stat().st_size <= max_size:
                    head = resolved.read_text(encoding="utf-8")[:500]
                    title = _extract_title(md_file, head)
            except (OSError, UnicodeDecodeError):
                pass

            files.append({
                "filename": md_file.name,
                "path": str(md_file),
                "title": title,
                "size_bytes": resolved.stat().st_size,
            })

    return {
        "directory": str(dir_path),
        "recursive": recursive,
        "count": len(files),
        "files": sorted(files, key=lambda f: f["path"]),
    }


# Registered AFTER the collection route above: Starlette's {path:path} converter
# also matches the empty string, so a catch-all declared first would swallow
# GET /api/v1/documents/.
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

    max_size = _max_file_size_bytes()
    try:
        size_bytes = path.stat().st_size
    except OSError as e:
        logger.error("Error stating file %s: %s", file_path, e)
        raise HTTPException(status_code=500, detail="Error reading file.")

    if size_bytes > max_size:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File is too large ({size_bytes} bytes). Maximum is "
                f"{get_settings().security.max_file_size_mb} MB."
            ),
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

    return {
        "filename": path.name,
        "path": str(path),
        "title": _extract_title(path, content),
        "content": content,
        "size_bytes": len(content.encode("utf-8")),
        "extension": path.suffix,
    }
