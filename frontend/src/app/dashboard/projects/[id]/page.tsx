'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  Bot,
  GitBranch,
  MessageSquare,
  FileCode2,
  Clock,
  Play,
  Plus,
  Code2,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  FileText,
  Settings,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project-store';
import { useAgentStore } from '@/stores/agent-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { cn, formatRelativeTime, formatCompactNumber } from '@/lib/utils';
import type { ProjectActivity } from '@/types';

// Status badge variant mapping
const statusVariantMap: Record<string, 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  draft: 'warning',
  archived: 'secondary',
};

const statusLabelMap: Record<string, string> = {
  active: '活跃',
  draft: '草稿',
  archived: '已归档',
};

// Activity icon mapping
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

// Role label mapping
const roleLabelMap: Record<string, string> = {
  owner: '负责人',
  admin: '管理员',
  developer: '开发者',
  viewer: '观察者',
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === id));
  const agents = useAgentStore((s) => s.agents.filter((a) => a.projectId === id));
  const workflows = useWorkflowStore((s) => s.workflows.filter((w) => !w.projectId || w.projectId === id));
  const activities = useProjectStore((s) =>
    s.activities.filter((a) => a.projectId === id)
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500">项目不存在</p>
      </div>
    );
  }

  const stats = project.stats;
  const recentActivities = activities.slice(0, 5);

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
                <Badge variant={statusVariantMap[project.status] ?? 'secondary'}>
                  {statusLabelMap[project.status] ?? project.status}
                </Badge>
              </div>
              <p className="text-sm text-zinc-400 mt-2">{project.description}</p>
            </div>
          </div>

          {/* Tech Stack */}
          {project.techStack && project.techStack.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 text-xs font-medium bg-brand-600/15 text-brand-400 rounded-lg"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

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

        {/* Team Members Card */}
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h3 className="text-sm font-medium text-white mb-4">团队成员</h3>
          {project.members && project.members.length > 0 ? (
            <div className="space-y-3">
              {project.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-xs font-medium overflow-hidden">
                    {member.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatar}
                        alt={member.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      member.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{member.username}</p>
                    <p className="text-xs text-zinc-500">{roleLabelMap[member.role] ?? member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">暂无成员</p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={Bot}
          label="Agent 数量"
          value={stats?.totalAgents ?? agents.length}
          color="text-brand-400"
        />
        <StatCard
          icon={GitBranch}
          label="工作流数量"
          value={stats?.totalWorkflows ?? workflows.length}
          color="text-green-400"
        />
        <StatCard
          icon={MessageSquare}
          label="对话数量"
          value={stats?.totalConversations ?? 0}
          color="text-blue-400"
        />
        <StatCard
          icon={FileCode2}
          label="代码文件"
          value={stats?.codeFiles ?? 0}
          color="text-amber-400"
        />
        <StatCard
          icon={Clock}
          label="最近活动"
          value={stats?.lastActivityAt ? formatRelativeTime(stats.lastActivityAt) : '无'}
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

  const actionLabelMap: Record<string, string> = {
    completed_tests: '完成测试',
    approved_code: '审批通过',
    generated_code: '生成代码',
    created_config: '创建配置',
    flagged_issue: '标记问题',
  };

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
