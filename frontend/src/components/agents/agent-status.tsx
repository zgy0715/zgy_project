'use client';

import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/types';

interface AgentStatusProps {
  status: AgentStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<
  AgentStatus,
  { dot: string; label: string; badge: string }
> = {
  pending: {
    dot: 'bg-slate-400',
    label: '等待中',
    badge: 'bg-slate-400/15 text-slate-400',
  },
  planning: {
    dot: 'bg-amber-500 animate-thinking',
    label: '规划中',
    badge: 'bg-amber-500/15 text-amber-400',
  },
  executing: {
    dot: 'bg-blue-500',
    label: '执行中',
    badge: 'bg-blue-500/15 text-blue-400',
  },
  reviewing: {
    dot: 'bg-violet-500',
    label: '审查中',
    badge: 'bg-violet-500/15 text-violet-400',
  },
  completed: {
    dot: 'bg-green-500',
    label: '完成',
    badge: 'bg-green-500/15 text-green-400',
  },
  failed: {
    dot: 'bg-red-500',
    label: '错误',
    badge: 'bg-red-500/15 text-red-400',
  },
  cancelled: {
    dot: 'bg-zinc-500',
    label: '已取消',
    badge: 'bg-zinc-500/15 text-zinc-400',
  },
};

const dotSizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
};

// Small dot indicator for agent list
export function AgentStatusDot({
  status,
  size = 'sm',
}: {
  status: AgentStatus;
  size?: 'sm' | 'md';
}) {
  const config = statusConfig[status];
  return (
    <div
      className={cn('rounded-full flex-shrink-0', dotSizeMap[size], config.dot)}
    />
  );
}

// Badge component with dot + label
export function AgentStatusBadge({
  status,
  size = 'md',
  showLabel = true,
}: AgentStatusProps) {
  const config = statusConfig[status];

  if (!showLabel) {
    return <AgentStatusDot status={status} size={size} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.badge
      )}
    >
      <span className={cn('rounded-full w-1.5 h-1.5', config.dot)} />
      {config.label}
    </span>
  );
}
