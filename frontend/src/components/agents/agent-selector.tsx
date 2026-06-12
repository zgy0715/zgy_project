'use client';

import { cn } from '@/lib/utils';
import { AgentStatusDot } from './agent-status';
import type { Agent } from '@/types';

// Agent type emoji map
const agentEmojiMap: Record<string, string> = {
  coder: '🧑‍💻',
  reviewer: '🔍',
  tester: '🧪',
  deployer: '🚀',
  planner: '📋',
  custom: '⚙️',
};

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentId: string | null; // null means "all agents"
  onSelectAgent: (agentId: string | null) => void;
}

export function AgentSelector({
  agents,
  selectedAgentId,
  onSelectAgent,
}: AgentSelectorProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {agents.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          const emoji = agentEmojiMap[agent.agentType] ?? '🤖';

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors',
                isSelected
                  ? 'bg-brand-600/15 text-white'
                  : 'text-zinc-400 hover:bg-surface-2 hover:text-white'
              )}
            >
              {/* Emoji icon */}
              <span className="text-base flex-shrink-0">{emoji}</span>

              {/* Agent name */}
              <span className="text-sm font-medium flex-1 truncate">
                {agent.name}
              </span>

              {/* Status dot */}
              <AgentStatusDot status={agent.status} size="sm" />
            </button>
          );
        })}
      </div>

      {/* "All agents" button */}
      <div className="border-t border-surface-3 p-2">
        <button
          onClick={() => onSelectAgent(null)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors',
            selectedAgentId === null
              ? 'bg-brand-600/15 text-white'
              : 'text-zinc-400 hover:bg-surface-2 hover:text-white'
          )}
        >
          <span className="text-base flex-shrink-0">👥</span>
          <span className="text-sm font-medium">全部 Agent</span>
        </button>
      </div>
    </div>
  );
}
