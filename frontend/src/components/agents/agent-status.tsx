import { cn } from '@/lib/utils';
import { AGENT_STATUS_META } from '@/lib/constants';
import type { AgentStatus } from '@/types';

interface AgentStatusIndicatorProps {
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeMap = {
  sm: { dot: 'w-2 h-2', text: 'text-xs' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-sm' },
  lg: { dot: 'w-3 h-3', text: 'text-base' },
};

export function AgentStatusIndicator({
  status,
  size = 'md',
  showLabel = true,
}: AgentStatusIndicatorProps) {
  const meta = AGENT_STATUS_META[status];
  const sizes = sizeMap[size];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'rounded-full',
          sizes.dot,
          meta.className,
          status === 'thinking' && 'animate-thinking'
        )}
      />
      {showLabel && (
        <span className={cn('text-zinc-400', sizes.text)}>{meta.label}</span>
      )}
    </div>
  );
}
