'use client';

import { cn } from '@/lib/utils';
import { AGENT_TYPE_META } from '@/lib/constants';
import { AgentStatusIndicator } from './agent-status';
import type { Agent } from '@/types';

interface AgentSelectorProps {
  agents: Agent[];
  currentAgent: Agent | null;
  onSelect: (agent: Agent) => void;
}

export function AgentSelector({ agents, currentAgent, onSelect }: AgentSelectorProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-500 font-medium">Select Agent</label>
      <div className="flex flex-wrap gap-2">
        {agents.map((agent) => {
          const meta = AGENT_TYPE_META[agent.type];
          const isSelected = currentAgent?.id === agent.id;

          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors border',
                isSelected
                  ? 'bg-brand-600/20 border-brand-500/50 text-brand-400'
                  : 'bg-surface-2 border-surface-3 text-zinc-400 hover:text-white hover:border-surface-4'
              )}
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: meta.color + '20', color: meta.color }}
              >
                {meta.label.charAt(0)}
              </div>
              <span>{agent.name}</span>
              <AgentStatusIndicator status={agent.status} size="sm" showLabel={false} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
