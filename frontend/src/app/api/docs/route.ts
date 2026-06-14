import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, resolve, extname, dirname } from 'path';

const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.mdx'];
const PROJECT_ROOT = resolve(process.cwd(), '..');

function isPathAllowed(filePath: string): boolean {
  const resolved = resolve(filePath);
  return resolved.startsWith(PROJECT_ROOT);
}

export async function GET(request: NextRequest) {
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

    const content = await readFile(fullPath, 'utf-8');

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
      filename: fullPath.split(/[/\\]/).pop(),
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
    return NextResponse.json(
      { error: `Error reading file: ${message}` },
      { status: 500 }
    );
  }
}
