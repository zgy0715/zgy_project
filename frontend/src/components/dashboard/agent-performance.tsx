'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { AgentPerformance } from '@/types';

interface AgentPerformanceChartProps {
  data: AgentPerformance[];
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-surface-3 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-white mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs text-zinc-400">
          {entry.dataKey === 'successRate'
            ? `Success: ${entry.value}%`
            : entry.dataKey === 'totalTasks'
            ? `Tasks: ${entry.value}`
            : `Avg Latency: ${entry.value}ms`}
        </p>
      ))}
    </div>
  );
}

export function AgentPerformanceChart({ data }: AgentPerformanceChartProps) {
  const chartData = data.map((d) => ({
    name: d.agentName,
    successRate: Math.round(d.successRate * 100),
    totalTasks: d.totalTasks,
    avgLatency: Math.round(d.avgLatency),
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#3f3f46' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="successRate" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalTasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
