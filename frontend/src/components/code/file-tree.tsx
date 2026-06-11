'use client';

import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import type { ProjectFile } from '@/types';

interface FileTreeProps {
  files: ProjectFile[];
  onFileSelect: (file: ProjectFile) => void;
  activeFilePath?: string;
}

export function FileTree({ files, onFileSelect, activeFilePath }: FileTreeProps) {
  return (
    <div className="py-2 text-sm">
      {files.map((file) => (
        <FileTreeNode
          key={file.id}
          file={file}
          depth={0}
          onFileSelect={onFileSelect}
          activeFilePath={activeFilePath}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  file: ProjectFile;
  depth: number;
  onFileSelect: (file: ProjectFile) => void;
  activeFilePath?: string;
}

function FileTreeNode({ file, depth, onFileSelect, activeFilePath }: FileTreeNodeProps) {
  const expandedDirs = useEditorStore((s) => s.expandedDirs);
  const toggleDir = useEditorStore((s) => s.toggleDir);
  const isExpanded = expandedDirs.has(file.path);
  const isDirectory = file.type === 'directory';
  const isActive = file.path === activeFilePath;

  const handleClick = () => {
    if (isDirectory) {
      toggleDir(file.path);
    } else {
      onFileSelect(file);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1 hover:bg-surface-2 transition-colors text-left',
          isActive && 'bg-brand-600/20 text-brand-400',
          !isActive && 'text-zinc-400'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/collapse arrow for directories */}
        {isDirectory ? (
          <svg
            className={cn(
              'w-4 h-4 flex-shrink-0 transition-transform',
              isExpanded && 'rotate-90'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* File/directory icon */}
        <span className="flex-shrink-0 text-xs">
          {isDirectory ? (isExpanded ? '📂' : '📁') : getFileIcon(file.name)}
        </span>

        {/* Name */}
        <span className="truncate">{file.name}</span>
      </button>

      {/* Children */}
      {isDirectory && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileTreeNode
              key={child.id}
              file={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              activeFilePath={activeFilePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Map file extensions to emoji icons
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    ts: '🟦',
    tsx: '🟦',
    js: '🟨',
    jsx: '🟨',
    py: '🐍',
    rs: '🦀',
    go: '🔵',
    java: '☕',
    json: '📋',
    yaml: '📋',
    yml: '📋',
    md: '📝',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    sql: '🗃️',
    sh: '⚙️',
    gitignore: '🙈',
    env: '🔒',
  };
  return iconMap[ext] ?? '📄';
}
