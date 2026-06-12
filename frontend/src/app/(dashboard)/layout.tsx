'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Bot,
  GitBranch,
  Settings,
  LogOut,
  Search,
  Bell,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/lib/hooks/use-auth';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { ToastProvider } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Sidebar navigation items
const navItems = [
  { label: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  { label: '项目', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Agent', href: '/dashboard/agents', icon: Bot },
  { label: '工作流', href: '/dashboard/workflows', icon: GitBranch },
  { label: '设置', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Connect to WebSocket for real-time updates
  useWebSocket();

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <DashboardHeader />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-surface-0 p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className="flex flex-col w-[240px] border-r border-surface-3 bg-surface-1 shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-surface-3">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">DA</span>
        </div>
        <span className="text-lg font-bold text-white">DeepAgent</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-zinc-400 hover:text-white hover:bg-surface-2'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-surface-3 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-medium">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.username ?? '用户'}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-surface-2 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function DashboardHeader() {
  const pathname = usePathname();

  // Build breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbMap: Record<string, string> = {
    dashboard: '仪表盘',
    projects: '项目',
    agents: 'Agent',
    workflows: '工作流',
    settings: '设置',
    code: '代码',
    workflow: '工作流',
  };

  const breadcrumbs = segments.map((seg, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = breadcrumbMap[seg] ?? seg;
    return { label, href: index < segments.length - 1 ? href : undefined };
  });

  return (
    <header className="h-14 border-b border-surface-3 bg-surface-0/80 backdrop-blur-md flex items-center justify-between px-6">
      {/* Breadcrumbs */}
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

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="搜索..."
            className="h-8 w-48 rounded-lg border border-surface-3 bg-surface-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
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
      </div>
    </header>
  );
}
