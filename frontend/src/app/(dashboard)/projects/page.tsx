'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Project } from '@/types';

// Mock projects for demo
const mockProjects: Project[] = [
  {
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
  },
  {
    id: 'proj-2',
    name: 'ML Pipeline Service',
    description: 'Data processing and ML model training pipeline',
    status: 'active',
    ownerId: 'u1',
    members: [
      { userId: 'u1', username: 'Alice', role: 'owner', joinedAt: '' },
    ],
    techStack: ['Python', 'FastAPI', 'Redis'],
    stats: { totalAgents: 3, totalWorkflows: 1, totalConversations: 15, totalTokens: 85000, codeFiles: 32, lastActivityAt: new Date().toISOString() },
    createdAt: '2024-02-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proj-3',
    name: 'Dashboard Frontend',
    description: 'React dashboard with real-time data visualization',
    status: 'draft',
    ownerId: 'u1',
    members: [
      { userId: 'u1', username: 'Alice', role: 'owner', joinedAt: '' },
    ],
    techStack: ['React', 'TypeScript', 'TailwindCSS'],
    stats: { totalAgents: 2, totalWorkflows: 0, totalConversations: 5, totalTokens: 23000, codeFiles: 18, lastActivityAt: new Date().toISOString() },
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your projects and collaborate with AI agents
          </p>
        </div>
        <Button>
          <span className="mr-2">+</span>
          New Project
        </Button>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="hover:border-brand-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-6">
                {/* Project name & status */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {project.name}
                  </h3>
                  <Badge
                    variant={
                      project.status === 'active' ? 'success' : 'secondary'
                    }
                  >
                    {project.status}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Tech stack */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(project.techStack ?? []).map((tech) => (
                    <Badge key={tech} variant="outline">
                      {tech}
                    </Badge>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-surface-3 pt-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {project.stats?.totalAgents ?? 0}
                    </p>
                    <p className="text-xs text-zinc-500">Agents</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {project.stats?.totalWorkflows ?? 0}
                    </p>
                    <p className="text-xs text-zinc-500">Workflows</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {project.stats?.codeFiles ?? 0}
                    </p>
                    <p className="text-xs text-zinc-500">Files</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
