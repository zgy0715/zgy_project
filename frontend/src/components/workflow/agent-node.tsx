'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { AGENT_TYPE_META, AGENT_STATUS_META } from '@/lib/constants';
import type { WorkflowNodeData } from '@/types';

// Custom agent node for the workflow DAG editor
function AgentNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const meta = AGENT_TYPE_META[data.agentType ?? 'custom'];
  const statusMeta = AGENT_STATUS_META[data.status ?? 'idle'];

  return (
    <div
      className={cn(
        'bg-surface-1 border-2 rounded-xl px-4 py-3 min-w-[180px] shadow-lg transition-all',
        selected ? 'border-brand-500 shadow-brand-500/20' : 'border-surface-3',
        data.status === 'running' && 'border-blue-500 shadow-blue-500/20',
        data.status === 'error' && 'border-red-500 shadow-red-500/20',
        data.status === 'success' && 'border-green-500 shadow-green-500/20'
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-surface-4 !border-surface-3 !w-3 !h-3"
      />

      {/* Node header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ backgroundColor: meta.color + '20', color: meta.color }}
        >
          {meta.label.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{data.label}</p>
          <p className="text-xs text-zinc-500">{meta.label}</p>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <div className={cn('w-2 h-2 rounded-full', statusMeta.className)} />
        <span className="text-xs text-zinc-400">{statusMeta.label}</span>
      </div>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
          {data.description}
        </p>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-surface-4 !border-surface-3 !w-3 !h-3"
      />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
