'use client';

import { useEffect, useRef } from 'react';
import { FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface FileContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function FileContextMenu({ x, y, actions, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 50,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="min-w-[160px] py-1 rounded-md border border-surface-3 bg-surface-1 shadow-lg"
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
            action.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-zinc-300 hover:bg-surface-2'
          }`}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// Helper to build context menu actions for a file/directory
export function getContextMenuActions(
  fileType: 'file' | 'directory',
  callbacks: {
    onCreateFile?: () => void;
    onCreateFolder?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
  }
): ContextMenuAction[] {
  const actions: ContextMenuAction[] = [];

  if (fileType === 'directory') {
    if (callbacks.onCreateFile) {
      actions.push({
        label: '新建文件',
        icon: <FilePlus className="w-4 h-4" />,
        onClick: callbacks.onCreateFile,
      });
    }
    if (callbacks.onCreateFolder) {
      actions.push({
        label: '新建文件夹',
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: callbacks.onCreateFolder,
      });
    }
  }

  if (callbacks.onRename) {
    actions.push({
      label: '重命名',
      icon: <Pencil className="w-4 h-4" />,
      onClick: callbacks.onRename,
    });
  }

  if (callbacks.onDelete) {
    actions.push({
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: callbacks.onDelete,
      danger: true,
    });
  }

  return actions;
}
