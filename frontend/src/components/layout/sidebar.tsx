'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/lib/hooks/use-auth';

// Sidebar navigation items
const navItems = [
  { label: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  { label: '项目', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Agent', href: '/dashboard/agents', icon: Bot },
  { label: '工作流', href: '/dashboard/workflows', icon: GitBranch },
  { label: '设置', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-surface-3 bg-surface-1 transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-surface-3">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">DA</span>
            </div>
            <span className="text-lg font-bold text-white">DeepAgent</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
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
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-surface-3 p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2',
            collapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-medium">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.username ?? '用户'}
              </p>
            </div>
          )}
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
