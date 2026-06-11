'use client';

import { formatRelativeTime } from '@/lib/utils';
import type { ProjectActivity } from '@/types';

interface ActivityFeedProps {
  activities: ProjectActivity[];
}

const actionIcons: Record<string, string> = {
  created: '🆕',
  updated: '✏️',
  deleted: '🗑️',
  deployed: '🚀',
  commented: '💬',
  joined: '👋',
  completed: '✅',
  failed: '❌',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 py-3 px-4 rounded-lg hover:bg-surface-2 transition-colors"
        >
          <span className="text-lg mt-0.5">
            {actionIcons[activity.action] ?? '📌'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300">
              <span className="font-medium text-white">
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
