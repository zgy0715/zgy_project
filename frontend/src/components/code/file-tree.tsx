'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileCode, FileText, Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { FileContextMenu, getContextMenuActions } from '@/components/code/file-context-menu';
import type { ProjectFile } from '@/types';

interface FileTreeProps {
  files: ProjectFile[];
  onFileSelect: (path: string) => void;
  activeFilePath?: string;
}

export function FileTree({ files, onFileSelect, activeFilePath }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: ProjectFile;
  } | null>(null);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{
    parentPath: string;
    type: 'file' | 'directory';
  } | null>(null);

  const createFile = useEditorStore((s) => s.createFile);
  const deleteFile = useEditorStore((s) => s.deleteFile);
  const renameFile = useEditorStore((s) => s.renameFile);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: ProjectFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleStartRename = useCallback((path: string) => {
    setRenamingPath(path);
  }, []);

  const handleStartCreate = useCallback((parentPath: string, type: 'file' | 'directory') => {
    setCreatingIn({ parentPath, type });
  }, []);

  const handleRenameSubmit = useCallback(
    (path: string, newName: string) => {
      if (newName.trim()) {
        renameFile(path, newName.trim());
      }
      setRenamingPath(null);
    },
    [renameFile]
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const handleCreateSubmit = useCallback(
    (parentPath: string, name: string, type: 'file' | 'directory') => {
      if (name.trim()) {
        createFile(parentPath, name.trim(), type);
      }
      setCreatingIn(null);
    },
    [createFile]
  );

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
  }, []);

  const handleDelete = useCallback(
    (path: string) => {
      deleteFile(path);
    },
    [deleteFile]
  );

  return (
    <div className="py-1 text-sm">
      {files.map((file) => (
        <FileTreeNode
          key={file.id}
          file={file}
          depth={0}
          onFileSelect={onFileSelect}
          activeFilePath={activeFilePath}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={handleRenameCancel}
          creatingIn={creatingIn}
          onCreateSubmit={handleCreateSubmit}
          onCreateCancel={handleCreateCancel}
        />
      ))}

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions(contextMenu.file.type, {
            onCreateFile:
              contextMenu.file.type === 'directory'
                ? () => handleStartCreate(contextMenu.file.path, 'file')
                : undefined,
            onCreateFolder:
              contextMenu.file.type === 'directory'
                ? () => handleStartCreate(contextMenu.file.path, 'directory')
                : undefined,
            onRename: () => handleStartRename(contextMenu.file.path),
            onDelete: () => handleDelete(contextMenu.file.path),
          })}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

interface FileTreeNodeProps {
  file: ProjectFile;
  depth: number;
  onFileSelect: (path: string) => void;
  activeFilePath?: string;
  onContextMenu: (e: React.MouseEvent, file: ProjectFile) => void;
  renamingPath: string | null;
  onRenameSubmit: (path: string, newName: string) => void;
  onRenameCancel: () => void;
  creatingIn: { parentPath: string; type: 'file' | 'directory' } | null;
  onCreateSubmit: (parentPath: string, name: string, type: 'file' | 'directory') => void;
  onCreateCancel: () => void;
}

function FileTreeNode({
  file,
  depth,
  onFileSelect,
  activeFilePath,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  creatingIn,
  onCreateSubmit,
  onCreateCancel,
}: FileTreeNodeProps) {
  const expandedDirs = useEditorStore((s) => s.expandedDirs);
  const toggleDir = useEditorStore((s) => s.toggleDir);
  const openTabs = useEditorStore((s) => s.openTabs);

  const isExpanded = expandedDirs.has(file.path);
  const isDirectory = file.type === 'directory';
  const isActive = file.path === activeFilePath;
  const isRenaming = renamingPath === file.path;
  const isDirty = !isDirectory && openTabs.some((t) => t.path === file.path && t.isDirty);

  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      // Select name without extension for files
      const dotIndex = file.name.lastIndexOf('.');
      renameInputRef.current.setSelectionRange(
        0,
        isDirectory ? file.name.length : dotIndex > 0 ? dotIndex : file.name.length
      );
    }
  }, [isRenaming, file.name, isDirectory]);

  const handleClick = () => {
    if (isRenaming) return;
    if (isDirectory) {
      toggleDir(file.path);
    } else {
      onFileSelect(file.path);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRenameSubmit(file.path, renameInputRef.current?.value ?? '');
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  };

  const handleRenameBlur = () => {
    onRenameSubmit(file.path, renameInputRef.current?.value ?? '');
  };

  const FileIcon = isDirectory
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIconComponent(file.name);

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, file)}
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

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            defaultValue={file.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0 text-sm bg-surface-2 border border-surface-3 rounded text-zinc-200 outline-none focus:border-brand-500"
          />
        ) : (
          <span className="truncate">{file.name}</span>
        )}

        {/* Dirty indicator */}
        {isDirty && !isRenaming && (
          <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
        )}
      </button>

      {/* Children */}
      {isDirectory && isExpanded && (
        <div>
          {/* Inline create input */}
          {creatingIn && creatingIn.parentPath === file.path && (
            <InlineCreateInput
              depth={depth + 1}
              type={creatingIn.type}
              onSubmit={(name) => onCreateSubmit(file.path, name, creatingIn.type)}
              onCancel={onCreateCancel}
            />
          )}
          {file.children?.map((child) => (
            <FileTreeNode
              key={child.id}
              file={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              activeFilePath={activeFilePath}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              creatingIn={creatingIn}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline input for creating new files/folders
function InlineCreateInput({
  depth,
  type,
  onSubmit,
  onCancel,
}: {
  depth: number;
  type: 'file' | 'directory';
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit(inputRef.current?.value ?? '');
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    const val = inputRef.current?.value?.trim();
    if (val) {
      onSubmit(val);
    } else {
      onCancel();
    }
  };

  const Icon = type === 'directory' ? Folder : FileText;

  return (
    <div
      className="flex items-center gap-1.5 py-1 pr-2"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <span className="w-3.5 flex-shrink-0" />
      <Icon className="w-4 h-4 flex-shrink-0 text-zinc-500" />
      <input
        ref={inputRef}
        placeholder={type === 'directory' ? '文件夹名称' : '文件名称'}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 min-w-0 px-1 py-0 text-sm bg-surface-2 border border-surface-3 rounded text-zinc-200 outline-none focus:border-brand-500 placeholder:text-zinc-600"
      />
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
