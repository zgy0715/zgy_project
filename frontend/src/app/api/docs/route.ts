import { NextRequest, NextResponse } from 'next/server';
import { readFile, realpath, stat } from 'fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'path';

const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.mdx'];
const PROJECT_ROOT = resolve(process.cwd(), '..');
const AUTH_COOKIE_NAME = 'deepagent_authenticated';

// Component-wise containment check — the equivalent of Python's Path.is_relative_to.
// A raw `startsWith(PROJECT_ROOT)` prefix test also accepts a SIBLING directory
// whose name merely begins with the project directory name (e.g. ".../zgy_project-evil").
function isPathAllowed(filePath: string): boolean {
  const rel = relative(PROJECT_ROOT, resolve(filePath));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export async function GET(request: NextRequest) {
  // /api/docs reads files out of the repository, so it is gated on the same cookie
  // the dashboard middleware uses. That cookie is a client-written UX gate, not a
  // security boundary (see stores/auth-store.ts) — real enforcement is the JWT
  // check in api-gateway. The middleware also gates this path before we get here.
  if (request.cookies.get(AUTH_COOKIE_NAME)?.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json(
      { error: 'Missing "path" query parameter' },
      { status: 400 }
    );
  }

  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `File extension "${ext}" not allowed. Only ${ALLOWED_EXTENSIONS.join(', ')} are supported.` },
      { status: 400 }
    );
  }

  const fullPath = join(PROJECT_ROOT, filePath);

  if (!isPathAllowed(fullPath)) {
    return NextResponse.json(
      { error: 'Access denied: file path is outside project directory.' },
      { status: 403 }
    );
  }

  try {
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      return NextResponse.json(
        { error: 'Not a file.' },
        { status: 400 }
      );
    }

    // Re-check after resolving symlinks, so a link that lives inside the project
    // cannot be used to read a file outside it.
    const realFullPath = await realpath(fullPath);
    if (!isPathAllowed(realFullPath)) {
      return NextResponse.json(
        { error: 'Access denied: file path is outside project directory.' },
        { status: 403 }
      );
    }

    const content = await readFile(realFullPath, 'utf-8');

    // Extract title from first heading
    let title = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || filePath;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        title = trimmed.slice(2).trim();
        break;
      }
    }

    return NextResponse.json({
      filename: realFullPath.split(/[/\\]/).pop(),
      path: filePath,
      title,
      content,
      size_bytes: fileStat.size,
      extension: ext,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `File not found: ${filePath}` },
        { status: 404 }
      );
    }
    if (message.includes('EACCES')) {
      return NextResponse.json(
        { error: 'Permission denied.' },
        { status: 403 }
      );
    }
    // Do not echo the raw error: it contains absolute server paths.
    console.error('[api/docs] failed to read file', err);
    return NextResponse.json(
      { error: 'Error reading file.' },
      { status: 500 }
    );
  }
}
