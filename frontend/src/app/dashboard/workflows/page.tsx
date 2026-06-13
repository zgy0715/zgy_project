'use client';

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
  created: 'Created',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
};

export default function WorkflowsPage() {
  const workflows = useWorkflowStore((s) => s.workflows);

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
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => alert('功能开发中')}>
            <span className="mr-2">▶</span>
            执行
          </Button>
          <Button onClick={() => alert('功能开发中')}>
            <span className="mr-2">+</span>
            New Workflow
          </Button>
        </div>
      </div>

      {/* Workflows grid */}
      {workflows.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-lg mb-2">暂无工作流</p>
          <p className="text-sm">点击&ldquo;新建工作流&rdquo;创建你的第一个AI工作流</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const agentNodeCount = workflow.nodes.filter(
    (n) => n.type === 'agent' || n.agentType !== 'trigger'
  ).length;
  const totalNodeCount = workflow.nodes.length;

  return (
    <div className="cursor-pointer">
      <Card className="hover:border-brand-500/50 transition-colors h-full">
        <CardContent className="p-6">
          {/* Workflow name & status */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">
              {workflow.name}
            </h3>
            <Badge variant={statusVariantMap[workflow.status] ?? 'secondary'}>
              {statusLabelMap[workflow.status] ?? workflow.status}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
            {workflow.description}
          </p>

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
            Updated {formatRelativeTime(workflow.updatedAt)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
