'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Bot,
  Code,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Project, ProjectActivity } from '@/types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Mock stats data
const statsData = [
  {
    title: '项目总数',
    value: '3',
    change: 12,
    icon: FolderKanban,
  },
  {
    title: 'Agent 运行',
    value: '156',
    suffix: '次',
    change: 28,
    icon: Bot,
  },
  {
    title: '代码生成',
    value: '12,847',
    suffix: '行',
    change: 45,
    icon: Code,
  },
  {
    title: '测试通过率',
    value: '94.2',
    suffix: '%',
    change: 3.1,
    icon: CheckCircle,
  },
];

// Mock project data
const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'API Gateway Service',
    description: '微服务网关项目，负责路由转发、限流熔断和认证鉴权',
    status: 'active',
    ownerId: 'u1',
    members: [],
    techStack: ['Go', 'gRPC', 'Redis', 'Docker'],
    stats: {
      totalAgents: 4,
      totalWorkflows: 2,
      totalConversations: 56,
      totalTokens: 128000,
      codeFiles: 42,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'proj-2',
    name: '数据分析平台',
    description: '企业级数据分析与可视化平台，支持多维度报表和实时大屏',
    status: 'active',
    ownerId: 'u1',
    members: [],
    techStack: ['Python', 'FastAPI', 'React', 'ClickHouse'],
    stats: {
      totalAgents: 3,
      totalWorkflows: 1,
      totalConversations: 38,
      totalTokens: 86000,
      codeFiles: 67,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'proj-3',
    name: '智能客服系统',
    description: '基于大模型的智能客服，支持多轮对话和知识库检索',
    status: 'draft',
    ownerId: 'u1',
    members: [],
    techStack: ['TypeScript', 'Next.js', 'LangChain', 'PostgreSQL'],
    stats: {
      totalAgents: 2,
      totalWorkflows: 0,
      totalConversations: 12,
      totalTokens: 34000,
      codeFiles: 18,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

// Mock activity data
const mockActivities: ProjectActivity[] = [
  {
    id: '1',
    projectId: 'proj-1',
    userId: 'a1',
    username: 'Coder Agent',
    action: '完成了代码生成',
    target: 'auth/login.ts',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: '2',
    projectId: 'proj-1',
    userId: 'a2',
    username: 'Reviewer Agent',
    action: '提交了代码审查',
    target: 'PR #42',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: '3',
    projectId: 'proj-2',
    userId: 'a3',
    username: 'Planner Agent',
    action: '更新了任务计划',
    target: 'Sprint 4',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '4',
    projectId: 'proj-1',
    userId: 'a4',
    username: 'Tester Agent',
    action: '运行了集成测试',
    target: 'api-gateway',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: '5',
    projectId: 'proj-2',
    userId: 'a1',
    username: 'Coder Agent',
    action: '创建了新文件',
    target: 'charts/dashboard.tsx',
    timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: '6',
    projectId: 'proj-3',
    userId: 'a2',
    username: 'Reviewer Agent',
    action: '发现了潜在问题',
    target: 'chat/handler.py',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: '7',
    projectId: 'proj-1',
    userId: 'a3',
    username: 'Planner Agent',
    action: '拆分了用户故事',
    target: 'US-128',
    timestamp: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
  },
  {
    id: '8',
    projectId: 'proj-2',
    userId: 'a4',
    username: 'Tester Agent',
    action: '测试全部通过',
    target: 'data-pipeline',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: '9',
    projectId: 'proj-3',
    userId: 'a1',
    username: 'Coder Agent',
    action: '重构了对话模块',
    target: 'chat/engine.ts',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: '10',
    projectId: 'proj-1',
    userId: 'a2',
    username: 'Reviewer Agent',
    action: '批准了合并请求',
    target: 'PR #39',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

// Agent name colors
const agentColors: Record<string, string> = {
  'Coder Agent': 'text-blue-400',
  'Reviewer Agent': 'text-amber-400',
  'Planner Agent': 'text-violet-400',
  'Tester Agent': 'text-green-400',
};

// Agent status dots for project cards
const agentDots = [
  { color: 'bg-blue-500', label: 'Coder' },
  { color: 'bg-amber-500', label: 'Reviewer' },
  { color: 'bg-violet-500', label: 'Planner' },
  { color: 'bg-green-500', label: 'Tester' },
];

export default function DashboardPage() {
  const projects = useProjectStore((s) => s.projects);
  const activities = useProjectStore((s) => s.activities);
  const user = useAuthStore((s) => s.user);

  // Use store data if available, otherwise fall back to mock data
  const displayProjects = projects.length > 0 ? projects : mockProjects;
  const displayActivities = activities.length > 0 ? activities : mockActivities;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            你好，{user?.username ?? '用户'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            以下是你的项目与 Agent 活动概览
          </p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsData.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              variants={itemVariants}
              className="bg-surface-1 border border-surface-3 rounded-xl p-6"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">
                    {stat.value}
                    {stat.suffix && (
                      <span className="text-base font-normal text-zinc-400 ml-0.5">
                        {stat.suffix}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    {stat.change >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span
                      className={cn(
                        'text-xs font-medium',
                        stat.change >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {stat.change >= 0 ? '+' : ''}
                      {stat.change}%
                    </span>
                    <span className="text-xs text-zinc-500">较上周</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-brand-600/15 text-brand-400">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Projects + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project cards */}
        <motion.div
          variants={containerVariants}
          className="lg:col-span-2 space-y-4"
        >
          <motion.h2
            variants={itemVariants}
            className="text-lg font-semibold text-white"
          >
            我的项目
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-white mb-4">活动流</h2>
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-4">
            <ActivityTimeline activities={displayActivities.slice(0, 10)} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Project card component
function ProjectCard({ project }: { project: Project }) {
  const statusVariant =
    project.status === 'active' ? 'success' : 'warning';
  const statusLabel = project.status === 'active' ? '进行中' : '草稿';

  return (
    <motion.div variants={itemVariants}>
      <Link href={`/dashboard/projects/${project.id}`}>
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-500/5 hover:border-surface-4 transition-all duration-200 cursor-pointer">
          {/* Title + status */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold text-white leading-tight">
              {project.name}
            </h3>
            <Badge variant={statusVariant} className="shrink-0 ml-2">
              {statusLabel}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
            {project.description}
          </p>

          {/* Tech stack tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.techStack.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs text-zinc-300"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Bottom: Agent dots + last activity */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-3">
            <div className="flex items-center gap-1.5">
              {agentDots.slice(0, project.stats.totalAgents).map((dot, i) => (
                <span
                  key={i}
                  className={cn('w-2 h-2 rounded-full', dot.color)}
                  title={dot.label}
                />
              ))}
              <span className="text-xs text-zinc-500 ml-1">
                {project.stats.totalAgents} 个 Agent
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {formatRelativeTime(project.stats.lastActivityAt)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Activity timeline component
function ActivityTimeline({ activities }: { activities: ProjectActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        暂无活动记录
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-3" />

      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 py-2.5">
          {/* Dot on the timeline */}
          <div className="relative z-10 mt-1.5 w-[11px] h-[11px] rounded-full bg-surface-2 border-2 border-surface-4 shrink-0" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300 leading-snug">
              <span
                className={cn(
                  'font-medium',
                  agentColors[activity.username] ?? 'text-white'
                )}
              >
                {activity.username}
              </span>{' '}
              {activity.action}{' '}
              <span className="text-brand-400">{activity.target}</span>
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
