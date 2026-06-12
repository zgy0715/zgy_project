'use client';

import { useState } from 'react';
import { FileCode, FileText, Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import type { ProjectFile } from '@/types';

interface FileTreeProps {
  files: ProjectFile[];
  onFileSelect: (path: string) => void;
  activeFilePath?: string;
}

export function FileTree({ files, onFileSelect, activeFilePath }: FileTreeProps) {
  return (
    <div className="py-1 text-sm">
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
  onFileSelect: (path: string) => void;
  activeFilePath?: string;
}

function FileTreeNode({ file, depth, onFileSelect, activeFilePath }: FileTreeNodeProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expandedDirs = useEditorStore((s) => s.expandedDirs);
  const toggleDir = useEditorStore((s) => s.toggleDir);

  // Sync with store expanded dirs, fallback to local state
  const isExpanded = expandedDirs.has(file.path) || localExpanded;
  const isDirectory = file.type === 'directory';
  const isActive = file.path === activeFilePath;

  const handleClick = () => {
    if (isDirectory) {
      toggleDir(file.path);
      setLocalExpanded((prev) => !prev);
    } else {
      onFileSelect(file.path);
    }
  };

  // Pick icon based on file type
  const FileIcon = isDirectory
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIconComponent(file.name);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1.5 py-1 pr-2 hover:bg-surface-2 transition-colors text-left',
          isActive && 'bg-brand-600/20 text-brand-400',
          !isActive && 'text-zinc-400'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse arrow */}
        {isDirectory ? (
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 flex-shrink-0 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* File/directory icon */}
        <FileIcon className="w-4 h-4 flex-shrink-0" />

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

// Map file name/extension to lucide-react icon component
function getFileIconComponent(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const codeExtensions = new Set([
    'java', 'py', 'ts', 'tsx', 'js', 'jsx', 'rs', 'go', 'rb', 'php',
    'c', 'cpp', 'h', 'hpp', 'cs', 'kt', 'swift', 'scala', 'sh', 'bash',
  ]);
  const textExtensions = new Set([
    'yml', 'yaml', 'xml', 'json', 'md', 'txt', 'env', 'toml', 'ini', 'cfg',
  ]);

  if (name === 'Dockerfile') return FileCode;
  if (codeExtensions.has(ext)) return FileCode;
  if (textExtensions.has(ext)) return FileText;
  return FileText;
}
