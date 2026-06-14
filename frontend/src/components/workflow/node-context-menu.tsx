'use client';

import { useEffect, useRef } from 'react';
import { Settings, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onConfigure: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onClose: () => void;
}

const menuItems = [
  { key: 'configure', label: '配置节点', icon: Settings, className: 'text-zinc-300 hover:text-white hover:bg-surface-2' },
  { key: 'duplicate', label: '复制节点', icon: Copy, className: 'text-zinc-300 hover:text-white hover:bg-surface-2' },
  { key: 'delete', label: '删除节点', icon: Trash2, className: 'text-red-400 hover:text-red-300 hover:bg-red-500/10' },
] as const;

export function NodeContextMenu({
  x,
  y,
  nodeId,
  onConfigure,
  onDelete,
  onDuplicate,
  onClose,
}: ContextMenuProps) {
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

  const handlers: Record<string, () => void> = {
    configure: () => onConfigure(nodeId),
    duplicate: () => onDuplicate(nodeId),
    delete: () => onDelete(nodeId),
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[160px] py-1 rounded-lg',
        'bg-surface-1 border border-surface-3 shadow-xl shadow-black/30'
      )}
      style={{ left: x, top: y }}
    >
      {menuItems.map((item) => (
        <button
          key={item.key}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
            item.className
          )}
          onClick={() => {
            handlers[item.key]();
            onClose();
          }}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
