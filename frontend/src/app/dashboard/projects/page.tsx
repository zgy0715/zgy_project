'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useProjectStore } from '@/stores/project-store';
import { AGENT_TYPE_META } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { projectStatusLabel, projectStatusVariant } from '@/types';

const PROJECT_AGENT_TYPES = ['coordinator', 'coder', 'reviewer', 'tester', 'deployer'] as const;

export default function ProjectsPage() {
  const projects = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<string>('coordinator');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const created = await createProject({
      name: name.trim(),
      description: description.trim(),
      agentType,
    });
    if (!created) return; // keep the dialog open so the error is visible
    setShowCreateDialog(false);
    setName('');
    setDescription('');
    setAgentType('coordinator');
  };

  const handleDelete = async (id: string) => {
    const deleted = await deleteProject(id);
    if (deleted) setDeleteConfirmId(null);
  };

  // Only block the whole page on the very first load; later mutations keep the list.
  if (isLoading && projects.length === 0) {
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
        <Button onClick={() => setShowCreateDialog(true)}>
          <span className="mr-2">+</span>
          新建项目
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">新建项目</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">项目名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：电商平台"
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">项目描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述项目的目标和范围..."
                  rows={3}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">主 Agent 类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {PROJECT_AGENT_TYPES.map((type) => {
                    const meta = AGENT_TYPE_META[type] ?? { label: type, color: '#94a3b8' };
                    return (
                      <button
                        key={type}
                        onClick={() => setAgentType(type)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          agentType === type
                            ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                            : 'border-surface-3 text-zinc-400 hover:border-surface-3 hover:bg-surface-2'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.label.charAt(0)}
                        </div>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={!name.trim()}>创建项目</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-3 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">确认删除</h2>
            <p className="text-sm text-zinc-400 mb-6">确定要删除这个项目吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
              <Button
                onClick={() => handleDelete(deleteConfirmId)}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-zinc-400 mb-4">暂无项目，创建你的第一个项目开始协作开发</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <span className="mr-2">+</span>
            新建项目
          </Button>
        </div>
      ) : (
        /* Projects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:border-brand-500/50 transition-colors h-full group">
              <CardContent className="p-6">
                {/* Project name & status */}
                <div className="flex items-start justify-between mb-3">
                  <Link href={`/dashboard/projects/${project.id}`} className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white hover:text-brand-400 transition-colors truncate">
                      {project.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <Badge variant={projectStatusVariant(project.status)}>
                      {projectStatusLabel(project.status)}
                    </Badge>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-surface-2 transition-all"
                      title="删除项目"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <Link href={`/dashboard/projects/${project.id}`}>
                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                </Link>

                {/* Agent type */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Badge variant="outline">
                    {AGENT_TYPE_META[project.agentType ?? '']?.label ?? project.agentType ?? '未指定'}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center border-t border-surface-3 pt-4">
                  <div>
                    <p className="text-sm font-semibold text-white truncate">
                      {formatRelativeTime(project.createdAt)}
                    </p>
                    <p className="text-xs text-zinc-500">创建于</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white truncate">
                      {formatRelativeTime(project.updatedAt)}
                    </p>
                    <p className="text-xs text-zinc-500">更新于</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
