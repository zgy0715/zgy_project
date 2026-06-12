'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, Plus, ChevronRight } from 'lucide-react';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project-store';

interface HeaderProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

// Build breadcrumbs from pathname
function useBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbMap: Record<string, string> = {
    dashboard: '仪表盘',
    projects: '项目',
    agents: 'Agent',
    workflows: '工作流',
    settings: '设置',
    code: '代码',
    workflow: '工作流',
  };

  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = breadcrumbMap[seg] ?? seg;
    return { label, href: index < segments.length - 1 ? href : undefined };
  });
}

export function Header({ title, breadcrumbs: propBreadcrumbs }: HeaderProps) {
  const pathname = usePathname();
  const autoBreadcrumbs = useBreadcrumbs();
  const breadcrumbs = propBreadcrumbs ?? autoBreadcrumbs;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const projects = useProjectStore((s) => s.projects);

  // Filter projects by search query
  const searchResults = searchQuery.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-surface-3 bg-surface-0/80 backdrop-blur-md flex items-center justify-between px-6">
      {/* Left: Breadcrumbs / Title */}
      <div className="flex items-center gap-2">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-lg font-semibold text-white">
            {title ?? 'Dashboard'}
          </h1>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="搜索项目..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="h-8 w-48 rounded-lg border border-surface-3 bg-surface-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
          />

          {/* Search results dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-surface-1 border border-surface-3 rounded-xl shadow-xl py-2 z-50">
              {searchResults.length > 0 ? (
                searchResults.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-600/15 flex items-center justify-center text-brand-400">
                      <span className="text-xs font-medium">
                        {project.name.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {project.description}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                  未找到匹配的项目
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
        </button>

        {/* New project button */}
        <Link href="/dashboard/projects">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            新建项目
          </Button>
        </Link>

        <UserMenu />
      </div>
    </header>
  );
}
