'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkflowStore } from '@/stores/workflow-store';
import { formatRelativeTime } from '@/lib/utils';
import type { Workflow } from '@/types';

const statusVariantMap: Record<string, 'success' | 'warning' | 'error' | 'secondary' | 'default'> = {
  created: 'secondary',
  running: 'warning',
  paused: 'default',
  completed: 'success',
  failed: 'error',
};

const statusLabelMap: Record<string, string> = {
  created: '已创建',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
};

export default function WorkflowsPage() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const createWorkflow = useWorkflowStore((s) => s.createWorkflow);
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow);
  const setCurrentWorkflow = useWorkflowStore((s) => s.setCurrentWorkflow);
  const executeWorkflow = useWorkflowStore((s) => s.executeWorkflow);
  const isLoading = useWorkflowStore((s) => s.isLoading);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!wfName.trim()) return;
    const now = Date.now();
    await createWorkflow({
      name: wfName.trim(),
      description: wfDesc.trim() || '新建工作流',
      nodes: [
        {
          id: `node-start-${now}`,
          type: 'trigger',
          name: 'Start',
          agentType: 'trigger',
          position: { x: 250, y: 50 },
          data: { label: 'Start', status: 'pending' },
        },
        {
          id: `node-end-${now}`,
          type: 'trigger',
          name: 'End',
          agentType: 'trigger',
          position: { x: 250, y: 500 },
          data: { label: 'End', status: 'pending' },
        },
      ],
      edges: [],
    });
    setShowCreateDialog(false);
    setWfName('');
    setWfDesc('');
  };

  const handleExecute = (workflow: Workflow) => {
    setCurrentWorkflow(workflow);
    executeWorkflow(workflow.projectId ?? '');
  };

  const handleDelete = async (id: string) => {
    await deleteWorkflow(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">工作流</h1>
          <p className="text-sm text-zinc-400 mt-1">
            管理和执行 AI Agent 工作流
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <span className="mr-2">+</span>
          新建工作流
        </Button>
      </div>

      {/* Create Workflow Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">新建工作流</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">工作流名称 *</label>
                <input
                  type="text"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="例如：代码生成与审查流程"
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">描述</label>
                <textarea
                  value={wfDesc}
                  onChange={(e) => setWfDesc(e.target.value)}
                  placeholder="描述工作流的功能和步骤..."
                  rows={2}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={!wfName.trim()}>创建工作流</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">确认删除</h2>
            <p className="text-sm text-zinc-400 mb-6">确定要删除这个工作流吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
              <Button onClick={() => handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-500 text-white">确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* Workflows grid */}
      {workflows.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-lg mb-2">暂无工作流</p>
          <p className="text-sm">点击"新建工作流"创建你的第一个AI工作流</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onExecute={handleExecute}
              onDelete={(id) => setDeleteConfirmId(id)}
              onSetCurrent={setCurrentWorkflow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onExecute,
  onDelete,
  onSetCurrent,
}: {
  workflow: Workflow;
  onExecute: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onSetCurrent: (workflow: Workflow) => void;
}) {
  const agentNodeCount = workflow.nodes.filter(
    (n) => n.type === 'agent' || n.agentType !== 'trigger'
  ).length;
  const totalNodeCount = workflow.nodes.length;

  return (
    <Card className="hover:border-brand-500/50 transition-colors h-full group">
      <CardContent className="p-6">
        {/* Workflow name & status */}
        <div className="flex items-start justify-between mb-3">
          {workflow.projectId ? (
            <Link
              href={`/dashboard/projects/${workflow.projectId}/workflow`}
              className="flex-1 min-w-0"
              onClick={() => onSetCurrent(workflow)}
            >
              <h3 className="text-lg font-semibold text-white hover:text-brand-400 transition-colors truncate">
                {workflow.name}
              </h3>
            </Link>
          ) : (
            <h3 className="text-lg font-semibold text-white truncate flex-1 min-w-0">
              {workflow.name}
            </h3>
          )}
          <Badge variant={statusVariantMap[workflow.status] ?? 'secondary'}>
            {statusLabelMap[workflow.status] ?? workflow.status}
          </Badge>
        </div>

        {/* Description */}
        {workflow.projectId ? (
          <Link
            href={`/dashboard/projects/${workflow.projectId}/workflow`}
            onClick={() => onSetCurrent(workflow)}
          >
            <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
              {workflow.description}
            </p>
          </Link>
        ) : (
          <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
            {workflow.description}
          </p>
        )}

        {/* Node preview */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {workflow.nodes
            .filter((n) => n.type === 'agent')
            .slice(0, 4)
            .map((node) => (
              <Badge key={node.id} variant="outline">
                {node.data?.label ?? node.name}
              </Badge>
            ))}
          {workflow.nodes.filter((n) => n.type === 'agent').length > 4 && (
            <Badge variant="outline">
              +{workflow.nodes.filter((n) => n.type === 'agent').length - 4}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center border-t border-surface-3 pt-4">
          <div>
            <p className="text-lg font-semibold text-white">
              {agentNodeCount}
            </p>
            <p className="text-xs text-zinc-500">Agents</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {totalNodeCount}
            </p>
            <p className="text-xs text-zinc-500">Nodes</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              v{workflow.version ?? 1}
            </p>
            <p className="text-xs text-zinc-500">Version</p>
          </div>
        </div>

        {/* Last updated */}
        <div className="mt-3 text-xs text-zinc-500">
          更新于 {formatRelativeTime(workflow.updatedAt)}
        </div>

        {/* Action buttons - visible on hover */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onExecute(workflow)}
            disabled={workflow.status === 'running'}
          >
            {workflow.status === 'running' ? '运行中...' : '执行'}
          </Button>
          {workflow.projectId ? (
            <Link
              href={`/dashboard/projects/${workflow.projectId}/workflow`}
              className="flex-1"
              onClick={() => onSetCurrent(workflow)}
            >
              <Button variant="outline" size="sm" className="w-full text-xs">
                编辑
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" className="flex-1 text-xs" disabled>
              编辑
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-red-400 hover:text-red-300 hover:border-red-500/50"
            onClick={() => onDelete(workflow.id)}
          >
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
