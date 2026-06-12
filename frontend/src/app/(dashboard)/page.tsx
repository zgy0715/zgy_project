'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Bot,
  Code,
  CheckCircle,
} from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useAuthStore } from '@/stores/auth-store';
import { mockDashboardStats } from '@/lib/mock-data';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AgentPerformanceChart } from '@/components/dashboard/agent-performance';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Project, AgentPerformance } from '@/types';

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

// Stats data derived from mockDashboardStats
const statsData = [
  {
    title: '项目总数',
    value: mockDashboardStats.totalProjects,
    change: 12,
    icon: <FolderKanban className="w-5 h-5" />,
  },
  {
    title: 'Agent 运行',
    value: mockDashboardStats.totalAgentRuns,
    suffix: '次',
    change: 28,
    icon: <Bot className="w-5 h-5" />,
  },
  {
    title: '代码生成',
    value: mockDashboardStats.totalCodeLines.toLocaleString(),
    suffix: '行',
    change: 45,
    icon: <Code className="w-5 h-5" />,
  },
  {
    title: '测试通过率',
    value: mockDashboardStats.testPassRate,
    suffix: '%',
    change: 3.1,
    icon: <CheckCircle className="w-5 h-5" />,
  },
];

// Mock agent performance data for the chart
const mockAgentPerformance: AgentPerformance[] = [
  {
    agentId: 'agent-coder',
    agentName: 'Coder',
    totalTasks: 42,
    successRate: 0.95,
    avgLatency: 1800,
    totalTokens: 52000,
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    agentId: 'agent-reviewer',
    agentName: 'Reviewer',
    totalTasks: 38,
    successRate: 0.92,
    avgLatency: 2100,
    totalTokens: 28000,
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    agentId: 'agent-tester',
    agentName: 'Tester',
    totalTasks: 35,
    successRate: 0.97,
    avgLatency: 2500,
    totalTokens: 45000,
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    agentId: 'agent-deployer',
    agentName: 'Deployer',
    totalTasks: 18,
    successRate: 0.89,
    avgLatency: 3200,
    totalTokens: 12000,
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

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
        {statsData.map((stat) => (
          <motion.div key={stat.title} variants={itemVariants}>
            <StatsCard
              title={stat.title}
              value={stat.value}
              suffix={stat.suffix}
              change={stat.change}
              icon={stat.icon}
            />
          </motion.div>
        ))}
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
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-white mb-4">活动流</h2>
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-4">
            <ActivityFeed activities={activities.slice(0, 10)} />
          </div>
        </motion.div>
      </div>

      {/* Agent Performance Chart */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white mb-4">Agent 性能</h2>
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
          <AgentPerformanceChart data={mockAgentPerformance} />
        </div>
      </motion.div>
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
            {(project.techStack ?? []).map((tech) => (
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
              {agentDots.slice(0, project.stats?.totalAgents ?? 0).map((dot, i) => (
                <span
                  key={i}
                  className={cn('w-2 h-2 rounded-full', dot.color)}
                  title={dot.label}
                />
              ))}
              <span className="text-xs text-zinc-500 ml-1">
                {project.stats?.totalAgents ?? 0} 个 Agent
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {formatRelativeTime(project.stats?.lastActivityAt ?? '')}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
