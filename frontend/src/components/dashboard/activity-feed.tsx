'use client';

import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ProjectActivity } from '@/types';

interface ActivityFeedProps {
  activities: ProjectActivity[];
}

// Agent name colors
const agentColors: Record<string, string> = {
  'Coder Agent': 'text-blue-400',
  'Reviewer Agent': 'text-amber-400',
  'Planner Agent': 'text-violet-400',
  'Tester Agent': 'text-green-400',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        暂无活动记录
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-3" />

      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 py-2.5">
          {/* Dot on the timeline */}
          <div className="relative z-10 mt-1.5 w-[11px] h-[11px] rounded-full bg-surface-2 border-2 border-surface-4 shrink-0" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300 leading-snug">
              <span
                className={cn(
                  'font-medium',
                  agentColors[activity.username] ?? 'text-white'
                )}
              >
                {activity.username}
              </span>{' '}
              {activity.action}{' '}
              <span className="text-brand-400">{activity.target}</span>
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
