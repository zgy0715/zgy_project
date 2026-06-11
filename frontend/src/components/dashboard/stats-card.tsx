import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, icon, className }: StatsCardProps) {
  const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;

  return (
    <div
      className={cn(
        'bg-surface-1 border border-surface-3 rounded-xl p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-bold text-white">{displayValue}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  change >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {change >= 0 ? '+' : ''}
                {change}%
              </span>
              <span className="text-xs text-zinc-500">vs last week</span>
            </div>
          )}
        </div>
        <div className="p-2 rounded-lg bg-surface-2 text-zinc-400">
          {icon}
        </div>
      </div>
    </div>
  );
}
