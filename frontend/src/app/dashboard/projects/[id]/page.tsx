'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Bot,
  GitBranch,
  Clock,
  Play,
  Plus,
  Code2,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  FileText,
  Settings,
  User,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project-store';
import { useAgentStore } from '@/stores/agent-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { cn, formatRelativeTime, formatCompactNumber } from '@/lib/utils';
import { projectStatusLabel, projectStatusVariant } from '@/types';
import type { ProjectActivity } from '@/types';

// Activity icon mapping (action keys are lower_snake_case from the gateway)
const activityIconMap: Record<string, React.ElementType> = {
  completed_tests: CheckCircle,
  approved_code: CheckCircle,
  generated_code: FileText,
  created_config: Settings,
  flagged_issue: AlertTriangle,
};

const activityColorMap: Record<string, string> = {
  completed_tests: 'text-green-400',
  approved_code: 'text-green-400',
  generated_code: 'text-brand-400',
  created_config: 'text-zinc-400',
  flagged_issue: 'text-amber-400',
};

const actionLabelMap: Record<string, string> = {
  completed_tests: '完成测试',
  approved_code: '审批通过',
  generated_code: '生成代码',
  created_config: '创建配置',
  flagged_issue: '标记问题',
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const project = useProjectStore((s) =>
    s.projects.find((p) => String(p.id) === String(id))
  );
  const fetchProject = useProjectStore((s) => s.fetchProject);
  const fetchActivities = useProjectStore((s) => s.fetchActivities);
  const activities = useProjectStore((s) => s.activities);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);

  const allAgents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const allWorkflows = useWorkflowStore((s) => s.workflows);
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows);

  // Load this project (detail + activity) and its agent/workflow counts.
  useEffect(() => {
    fetchProject(id);
    fetchActivities(id, { limit: 20 });
    fetchAgents(id);
    fetchWorkflows(id);
  }, [id, fetchProject, fetchActivities, fetchAgents, fetchWorkflows]);

  const agents = useMemo(
    () =>
      allAgents.filter((a) => !a.projectId || String(a.projectId) === String(id)),
    [allAgents, id]
  );
  const workflows = useMemo(
    () =>
      allWorkflows.filter((w) => String(w.projectId) === String(id)),
    [allWorkflows, id]
  );

  const recentActivities = activities.slice(0, 5);
  const lastActivityAt = activities[0]?.timestamp;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        ) : (
          <>
            <p className="text-zinc-500">项目不存在</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full pb-6">
      {/* Project Info & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Info Card */}
        <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{project.name}</h2>
                <Badge variant={projectStatusVariant(project.status)}>
                  {projectStatusLabel(project.status)}
                </Badge>
              </div>
              <p className="text-sm text-zinc-400 mt-2">{project.description}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex items-center gap-3">
            <Link href={`/dashboard/projects/${id}/workflow`}>
              <Button size="sm" className="gap-1.5">
                <Play className="w-4 h-4" />
                运行工作流
              </Button>
            </Link>
            <Link href={`/dashboard/projects/${id}/agents`}>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Plus className="w-4 h-4" />
                新建 Agent
              </Button>
            </Link>
            <Link href={`/dashboard/projects/${id}/code`}>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Code2 className="w-4 h-4" />
                查看代码
              </Button>
            </Link>
          </div>
        </div>

        {/* Project Metadata Card */}
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white mb-4">项目信息</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">负责人 ID</dt>
              <dd className="flex items-center gap-1.5 text-white">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                {project.ownerId ?? '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">默认 Agent</dt>
              <dd className="text-white">{project.agentType ?? '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">创建时间</dt>
              <dd className="text-white">{formatRelativeTime(project.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">更新时间</dt>
              <dd className="text-white">{formatRelativeTime(project.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Bot}
          label="Agent 数量"
          value={agents.length}
          color="text-brand-400"
        />
        <StatCard
          icon={GitBranch}
          label="工作流数量"
          value={workflows.length}
          color="text-green-400"
        />
        <StatCard
          icon={FileText}
          label="活动记录"
          value={activities.length}
          color="text-blue-400"
        />
        <StatCard
          icon={Clock}
          label="最近活动"
          value={lastActivityAt ? formatRelativeTime(lastActivityAt) : '无'}
          color="text-zinc-400"
          isText
        />
      </div>

      {/* Recent Activity & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white mb-4">最近活动</h3>
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">暂无活动记录</p>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white mb-4">快速导航</h3>
          <div className="space-y-2">
            <QuickLink
              href={`/dashboard/projects/${id}/workflow`}
              icon={GitBranch}
              label="工作流"
              description="管理和执行工作流"
            />
            <QuickLink
              href={`/dashboard/projects/${id}/agents`}
              icon={Bot}
              label="Agent 对话"
              description="与 Agent 交互对话"
            />
            <QuickLink
              href={`/dashboard/projects/${id}/code`}
              icon={Code2}
              label="代码编辑器"
              description="查看和编辑代码"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isText = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-surface-1 border border-surface-3 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">
        {isText ? value : typeof value === 'number' ? formatCompactNumber(value) : value}
      </p>
    </div>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: ProjectActivity }) {
  const IconComponent = activityIconMap[activity.action] ?? FileText;
  const iconColor = activityColorMap[activity.action] ?? 'text-zinc-400';

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
        <IconComponent className={cn('w-3.5 h-3.5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">
          <span className="font-medium">{activity.username}</span>
          <span className="text-zinc-400">
            {' '}{actionLabelMap[activity.action] ?? activity.action}{' '}
          </span>
          <span className="text-brand-400">{activity.target}</span>
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">
          {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
    </div>
  );
}

// Quick link component
function QuickLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
    </Link>
  );
}
