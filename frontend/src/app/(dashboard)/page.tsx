'use client';

import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AgentPerformanceChart } from '@/components/dashboard/agent-performance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProjectActivity, AgentPerformance } from '@/types';

// Placeholder data for demo
const mockActivities: ProjectActivity[] = [
  {
    id: '1',
    projectId: 'proj-1',
    userId: 'u1',
    username: 'Alice',
    action: 'created',
    target: 'API Gateway Service',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    projectId: 'proj-1',
    userId: 'u2',
    username: 'Coder Agent',
    action: 'completed',
    target: 'auth/login.ts',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '3',
    projectId: 'proj-1',
    userId: 'u3',
    username: 'Reviewer Agent',
    action: 'commented',
    target: 'PR #42',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '4',
    projectId: 'proj-1',
    userId: 'u4',
    username: 'Tester Agent',
    action: 'failed',
    target: 'integration tests',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const mockAgentPerformance: AgentPerformance[] = [
  { agentId: '1', agentName: 'Planner', totalTasks: 24, successRate: 0.92, avgLatency: 1200, totalTokens: 45000, lastActiveAt: new Date().toISOString() },
  { agentId: '2', agentName: 'Coder', totalTasks: 56, successRate: 0.87, avgLatency: 3400, totalTokens: 120000, lastActiveAt: new Date().toISOString() },
  { agentId: '3', agentName: 'Reviewer', totalTasks: 38, successRate: 0.95, avgLatency: 800, totalTokens: 32000, lastActiveAt: new Date().toISOString() },
  { agentId: '4', agentName: 'Tester', totalTasks: 42, successRate: 0.81, avgLatency: 5600, totalTokens: 67000, lastActiveAt: new Date().toISOString() },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Overview of your projects and agent activity
          </p>
        </div>
        <Link href="/dashboard/projects">
          <Button>View All Projects</Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Projects"
          value={5}
          change={12}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Active Agents"
          value={8}
          change={5}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Tasks Completed"
          value={160}
          change={23}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Tokens Used"
          value="264K"
          change={-8}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Performance Chart */}
        <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Agent Performance
          </h2>
          <AgentPerformanceChart data={mockAgentPerformance} />
        </div>

        {/* Activity Feed */}
        <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent Activity
          </h2>
          <ActivityFeed activities={mockActivities} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-surface-1 border border-surface-3 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-3 p-4 rounded-lg border border-surface-3 hover:border-brand-500/50 transition-colors"
          >
            <span className="text-2xl">📁</span>
            <div>
              <p className="text-sm font-medium text-white">New Project</p>
              <p className="text-xs text-zinc-400">Create a new project</p>
            </div>
          </Link>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-3 p-4 rounded-lg border border-surface-3 hover:border-brand-500/50 transition-colors"
          >
            <span className="text-2xl">🔄</span>
            <div>
              <p className="text-sm font-medium text-white">New Workflow</p>
              <p className="text-xs text-zinc-400">Design an agent workflow</p>
            </div>
          </Link>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-3 p-4 rounded-lg border border-surface-3 hover:border-brand-500/50 transition-colors"
          >
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-sm font-medium text-white">Chat with Agent</p>
              <p className="text-xs text-zinc-400">Start an agent conversation</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
