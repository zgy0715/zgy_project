'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAgentStore } from '@/stores/agent-store';
import { AGENT_TYPE_META, AGENT_STATUS_META } from '@/lib/constants';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Agent } from '@/types';

const AGENT_TYPES = ['coder', 'reviewer', 'tester', 'deployer'] as const;

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents);
  const thinkingChains = useAgentStore((s) => s.thinkingChains);
  const createAgent = useAgentStore((s) => s.createAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const isLoading = useAgentStore((s) => s.isLoading);
  const error = useAgentStore((s) => s.error);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState<string>('coder');
  const [agentDesc, setAgentDesc] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleCreate = async () => {
    if (!agentName.trim()) return;
    const typeMeta = AGENT_TYPE_META[agentType as keyof typeof AGENT_TYPE_META] ?? { label: agentType, color: '#94a3b8' };
    await createAgent({
      name: agentName.trim(),
      agentType: agentType as Agent['agentType'],
      description: agentDesc.trim() || `${typeMeta.label} Agent`,
      capabilities: getCapabilitiesForType(agentType),
      model: 'gpt-4o',
    });
    setShowCreateDialog(false);
    setAgentName('');
    setAgentType('coder');
    setAgentDesc('');
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
    setDeleteConfirmId(null);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditDesc(agent.description);
  };

  const handleSaveEdit = () => {
    if (!editingAgent || !editName.trim()) return;
    updateAgent(editingAgent.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setEditingAgent(null);
  };

  const handleToggleStatus = (agent: Agent) => {
    if (agent.status === 'pending') {
      updateAgent(agent.id, { status: 'executing' });
    } else if (agent.status === 'executing' || agent.status === 'planning') {
      updateAgent(agent.id, { status: 'completed' });
    } else {
      updateAgent(agent.id, { status: 'pending' });
    }
  };

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
        <Button onClick={() => setShowCreateDialog(true)}>
          <span className="mr-2">+</span>
          新建 Agent
        </Button>
      </div>

      {/* Create Agent Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">新建 Agent</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Agent 名称 *</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="例如：代码生成器"
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Agent 类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {AGENT_TYPES.map((type) => {
                    const meta = AGENT_TYPE_META[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setAgentType(type)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          agentType === type
                            ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                            : 'border-surface-3 text-zinc-400 hover:border-surface-3 hover:bg-surface-2'
                        }`}
                      >
                        <div className="w-6 h-6 rounded mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: meta.color }}>
                          {meta.label.charAt(0)}
                        </div>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">描述</label>
                <textarea
                  value={agentDesc}
                  onChange={(e) => setAgentDesc(e.target.value)}
                  placeholder="描述Agent的功能和职责..."
                  rows={2}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={!agentName.trim()}>创建 Agent</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Dialog */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">编辑 Agent</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Agent 名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">描述</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingAgent(null)}>取消</Button>
              <Button onClick={handleSaveEdit}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">确认删除</h2>
            <p className="text-sm text-zinc-400 mb-6">确定要删除这个 Agent 吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
              <Button onClick={() => handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-500 text-white">确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* Agents grid */}
      {agents.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-lg mb-2">暂无Agent</p>
          <p className="text-sm">点击"新建 Agent"创建你的第一个AI Agent</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              thinkingChain={thinkingChains.find((tc) => tc.agentId === agent.id)}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteConfirmId(id)}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getCapabilitiesForType(type: string): string[] {
  const caps: Record<string, string[]> = {
    coder: ['代码生成', '文件操作', '终端执行'],
    reviewer: ['代码审查', '安全检查', '最佳实践'],
    tester: ['测试生成', '覆盖率分析', 'Bug检测'],
    deployer: ['部署配置', '容器化', 'CI/CD'],
  };
  return caps[type] ?? ['通用能力'];
}

function AgentCard({
  agent,
  thinkingChain,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  agent: Agent;
  thinkingChain?: { steps: { step: string; thought: string }[] };
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (agent: Agent) => void;
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
    <Card className="hover:border-brand-500/50 transition-colors h-full group">
      <CardContent className="p-6">
        {/* Agent name & status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: typeMeta.color }}
            >
              {agent.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">
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

        {/* Action buttons - visible on hover */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onToggleStatus(agent)}
          >
            {agent.status === 'pending' ? '启动' : agent.status === 'completed' || agent.status === 'failed' ? '重启' : '停止'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onEdit(agent)}
          >
            编辑
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-red-400 hover:text-red-300 hover:border-red-500/50"
            onClick={() => onDelete(agent.id)}
          >
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
