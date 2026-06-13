'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAgentStore } from '@/stores/agent-store';
import { AGENT_TYPE_META, AGENT_STATUS_META } from '@/lib/constants';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Agent } from '@/types';

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents);
  const thinkingChains = useAgentStore((s) => s.thinkingChains);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent管理</h1>
          <p className="text-sm text-zinc-400 mt-1">
            管理和监控你的 AI Agent
          </p>
        </div>
        <Button onClick={() => alert('功能开发中')}>
          <span className="mr-2">+</span>
          New Agent
        </Button>
      </div>

      {/* Agents grid */}
      {agents.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg mb-2">暂无Agent</p>
          <p className="text-sm">点击&ldquo;新建Agent&rdquo;创建你的第一个AI Agent</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              thinkingChain={thinkingChains.find((tc) => tc.agentId === agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  thinkingChain,
}: {
  agent: Agent;
  thinkingChain?: { steps: { step: string; thought: string }[] };
}) {
  const typeMeta = AGENT_TYPE_META[agent.agentType] ?? {
    label: agent.agentType,
    color: '#94a3b8',
  };
  const statusMeta = AGENT_STATUS_META[agent.status] ?? {
    label: agent.status,
    color: '#94a3b8',
    className: 'bg-slate-400',
  };

  const isActive =
    agent.status === 'planning' ||
    agent.status === 'executing' ||
    agent.status === 'reviewing';

  return (
    <Card className="hover:border-brand-500/50 transition-colors cursor-pointer h-full">
      <CardContent className="p-6">
        {/* Agent name & status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: typeMeta.color }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {agent.name}
              </h3>
              <p className="text-xs text-zinc-500">{typeMeta.label}</p>
            </div>
          </div>
          <Badge
            variant={
              agent.status === 'completed'
                ? 'success'
                : agent.status === 'failed'
                  ? 'error'
                  : isActive
                    ? 'warning'
                    : 'secondary'
            }
          >
            <span
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                statusMeta.className
              )}
            />
            {statusMeta.label}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
          {agent.description}
        </p>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(agent.capabilities ?? []).map((cap) => (
            <Badge key={cap} variant="outline">
              {cap}
            </Badge>
          ))}
        </div>

        {/* Thinking chain status for active agents */}
        {isActive && thinkingChain && thinkingChain.steps.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-surface-2 border border-surface-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-400">
                Thinking Chain
              </span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2">
              {thinkingChain.steps[thinkingChain.steps.length - 1].thought}
            </p>
          </div>
        )}

        {/* Bottom stats */}
        <div className="grid grid-cols-2 gap-2 text-center border-t border-surface-3 pt-4">
          <div>
            <p className="text-sm font-semibold text-white">
              {agent.model ?? '-'}
            </p>
            <p className="text-xs text-zinc-500">Model</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {formatRelativeTime(agent.updatedAt)}
            </p>
            <p className="text-xs text-zinc-500">Last Active</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


