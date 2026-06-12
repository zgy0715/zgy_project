'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Code, Search, TestTube, Rocket, GitBranch, Play, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowNodeData } from '@/types';

// Agent type to icon mapping
const agentTypeIcons: Record<string, React.ReactNode> = {
  coder: <Code className="w-4 h-4" />,
  reviewer: <Search className="w-4 h-4" />,
  tester: <TestTube className="w-4 h-4" />,
  deployer: <Rocket className="w-4 h-4" />,
  planner: <GitBranch className="w-4 h-4" />,
  trigger: <Play className="w-4 h-4" />,
  output: <CircleDot className="w-4 h-4" />,
};

// Agent type to border color mapping
const agentTypeColors: Record<string, string> = {
  coder: '#3b82f6',     // blue
  reviewer: '#22c55e',  // green
  tester: '#f59e0b',    // yellow
  deployer: '#a855f7',  // purple
  planner: '#8b5cf6',   // violet
  trigger: '#6366f1',   // indigo
  output: '#6366f1',    // indigo
  condition: '#f59e0b', // amber
  custom: '#6366f1',    // indigo
};

// Status to indicator color mapping
const statusColors: Record<string, string> = {
  pending: '#71717a',      // zinc-500
  planning: '#f59e0b',     // amber-500
  executing: '#3b82f6',    // blue-500
  reviewing: '#8b5cf6',    // violet-500
  completed: '#22c55e',    // green-500
  failed: '#ef4444',       // red-500
};

// Status label mapping (Chinese)
const statusLabels: Record<string, string> = {
  pending: '等待中',
  planning: '规划中',
  executing: '执行中',
  reviewing: '审查中',
  completed: '已完成',
  failed: '错误',
};

// Custom agent node for the workflow DAG editor
function AgentNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const agentType = data.agentType ?? 'custom';
  const status = data.status ?? 'pending';
  const borderColor = agentTypeColors[agentType] ?? agentTypeColors.custom;
  const indicatorColor = statusColors[status] ?? statusColors.pending;
  const isRunning = status === 'executing' || status === 'planning';
  const icon = agentTypeIcons[agentType] ?? agentTypeIcons.custom;

  return (
    <motion.div
      initial={false}
      animate={{
        boxShadow: isRunning
          ? `0 0 20px ${borderColor}40, 0 0 40px ${borderColor}20`
          : selected
          ? `0 0 10px ${borderColor}30`
          : '0 4px 6px -1px rgba(0,0,0,0.3)',
      }}
      transition={{ duration: 0.3 }}
      style={{ borderColor }}
      className={cn(
        'bg-surface-1 border-2 rounded-xl px-4 py-3 min-w-[200px] relative',
        selected && 'ring-1 ring-offset-1 ring-offset-surface-0',
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-surface-3"
        style={{ backgroundColor: borderColor }}
      />

      {/* Node content */}
      <div className="flex items-center gap-3">
        {/* Left: Agent type icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: borderColor + '20', color: borderColor }}
        >
          {icon}
        </div>

        {/* Middle: Agent name + status text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{data.label}</p>
          <p className="text-xs text-zinc-500">{statusLabels[status]}</p>
        </div>

        {/* Right: Status indicator */}
        <div className="shrink-0">
          <motion.div
            animate={
              status === 'planning'
                ? { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }
                : status === 'executing'
                ? { scale: [1, 1.1, 1] }
                : {}
            }
            transition={
              status === 'planning'
                ? { duration: 1.5, repeat: Infinity }
                : status === 'executing'
                ? { duration: 1, repeat: Infinity }
                : {}
            }
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        </div>
      </div>

      {/* Progress bar (visible during running/thinking) */}
      {(status === 'executing' || status === 'planning') && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="mt-2 h-1 rounded-full bg-surface-3 overflow-hidden"
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: borderColor }}
            animate={{
              width: status === 'planning' ? ['0%', '40%'] : ['0%', '100%'],
            }}
            transition={
              status === 'planning'
                ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 3, repeat: Infinity, ease: 'linear' }
            }
          />
        </motion.div>
      )}

      {/* Description */}
      {data.description && status === 'pending' && (
        <p className="text-xs text-zinc-500 mt-2 line-clamp-1">
          {data.description}
        </p>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-surface-3"
        style={{ backgroundColor: borderColor }}
      />
    </motion.div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
