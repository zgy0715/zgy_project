'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useProjectStore } from '@/stores/project-store';

export default function ProjectsPage() {
  const { projects, fetchProjects, isLoading } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">项目</h1>
          <p className="text-sm text-zinc-400 mt-1">
            管理你的项目，与AI Agent协作开发
          </p>
        </div>
        <Button>
          <span className="mr-2">+</span>
          新建项目
        </Button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-zinc-400 mb-4">No projects yet. Create your first project to get started.</p>
          <Button>
            <span className="mr-2">+</span>
            New Project
          </Button>
        </div>
      ) : (
        /* Projects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
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
      )}
    </div>
  );
}
