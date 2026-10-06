'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { projectStatusLabel, projectStatusVariant } from '@/types';

// Tab navigation configuration
const tabs = [
  { label: '概览', href: (id: string) => `/dashboard/projects/${id}` },
  { label: '工作流', href: (id: string) => `/dashboard/projects/${id}/workflow` },
  { label: 'Agent 对话', href: (id: string) => `/dashboard/projects/${id}/agents` },
  { label: '代码编辑器', href: (id: string) => `/dashboard/projects/${id}/code` },
];

export default function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = params;
  const pathname = usePathname();
  // `id` comes from the URL as a string while the gateway serializes a Java
  // Long, so compare on string form.
  const project = useProjectStore((s) =>
    s.projects.find((p) => String(p.id) === String(id))
  );

  // Determine active tab from pathname
  const activeTab = tabs.findIndex((tab, index) => {
    const tabHref = tab.href(id);
    // Exact match for overview tab (first tab), startsWith for others
    if (index === 0) {
      return pathname === tabHref;
    }
    return pathname.startsWith(tabHref);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Project header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">
            {project?.name ?? '项目详情'}
          </h1>
          {project?.status && (
            <Badge variant={projectStatusVariant(project.status)}>
              {projectStatusLabel(project.status)}
            </Badge>
          )}
        </div>
        {project?.description && (
          <p className="text-sm text-zinc-400 mt-1">{project.description}</p>
        )}
      </div>

      {/* Tab navigation */}
      <nav className="flex border-b border-surface-3 mb-4">
        {tabs.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <Link
              key={tab.label}
              href={tab.href(id)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'text-brand-400'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
              {/* Active tab indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Tab content area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
