import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCompactNumber } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  change?: number;
  icon: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, suffix, change, icon, className }: StatsCardProps) {
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
          <p className="text-2xl font-bold text-white">
            {displayValue}
            {suffix && (
              <span className="text-base font-normal text-zinc-400 ml-0.5">
                {suffix}
              </span>
            )}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {change >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  change >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {change >= 0 ? '+' : ''}
                {change}%
              </span>
              <span className="text-xs text-zinc-500">较上周</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-brand-600/15 text-brand-400">
          {icon}
        </div>
      </div>
    </div>
  );
}
