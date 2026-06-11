'use client';

import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentStatusIndicator } from '@/components/agents/agent-status';
import { StatsCard } from '@/components/dashboard/stats-card';
import { AGENT_TYPE_META } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import type { Agent, Project } from '@/types';

// Mock project data
const mockProject: Project = {
  id: 'proj-1',
  name: 'E-Commerce API',
  description: 'RESTful API for e-commerce platform with auth, products, and orders',
  status: 'active',
  ownerId: 'u1',
  members: [
    { userId: 'u1', username: 'Alice', role: 'owner', joinedAt: '' },
    { userId: 'u2', username: 'Bob', role: 'developer', joinedAt: '' },
  ],
  techStack: ['TypeScript', 'Node.js', 'PostgreSQL'],
  stats: { totalAgents: 4, totalWorkflows: 2, totalConversations: 28, totalTokens: 120000, codeFiles: 45, lastActivityAt: new Date().toISOString() },
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: new Date().toISOString(),
};

const mockAgents: Agent[] = [
  { id: 'a1', name: 'Planner', type: 'planner', status: 'idle', description: 'Plans project architecture and task breakdown', capabilities: ['planning', 'architecture'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a2', name: 'Coder', type: 'coder', status: 'running', description: 'Writes and refactors code', capabilities: ['coding', 'refactoring'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a3', name: 'Reviewer', type: 'reviewer', status: 'idle', description: 'Reviews code quality and suggests improvements', capabilities: ['review', 'security'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a4', name: 'Tester', type: 'tester', status: 'success', description: 'Generates and runs tests', capabilities: ['testing', 'coverage'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = mockProject; // In real app: fetch by id

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/dashboard/projects" className="hover:text-white transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-white">{project.name}</span>
      </nav>

      {/* Project header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <Badge variant="success">{project.status}</Badge>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{project.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {project.techStack.map((tech) => (
              <Badge key={tech} variant="outline">{tech}</Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/projects/${id}/workflow`}>
            <Button variant="outline">Workflow</Button>
          </Link>
          <Link href={`/dashboard/projects/${id}/agents`}>
            <Button variant="outline">Agents</Button>
          </Link>
          <Link href={`/dashboard/projects/${id}/code`}>
            <Button>Code</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Agents" value={project.stats.totalAgents} icon={<span className="text-lg">🤖</span>} />
        <StatsCard title="Workflows" value={project.stats.totalWorkflows} icon={<span className="text-lg">🔄</span>} />
        <StatsCard title="Conversations" value={project.stats.totalConversations} icon={<span className="text-lg">💬</span>} />
        <StatsCard title="Code Files" value={project.stats.codeFiles} icon={<span className="text-lg">📄</span>} />
      </div>

      {/* Agents overview */}
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockAgents.map((agent) => {
              const meta = AGENT_TYPE_META[agent.type];
              return (
                <Link
                  key={agent.id}
                  href={`/dashboard/projects/${id}/agents`}
                  className="flex items-center gap-3 p-4 rounded-lg border border-surface-3 hover:border-brand-500/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium"
                    style={{ backgroundColor: meta.color + '20', color: meta.color }}
                  >
                    {meta.label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    <p className="text-xs text-zinc-500">{meta.label}</p>
                  </div>
                  <AgentStatusIndicator status={agent.status} size="sm" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
