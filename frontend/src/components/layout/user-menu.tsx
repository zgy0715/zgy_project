'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/lib/hooks/use-auth';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
          <span className="text-white text-xs font-medium">{initials}</span>
        </div>
        {user && (
          <span className="text-sm text-zinc-300 hidden sm:inline">
            {user.username}
          </span>
        )}
        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-surface-1 border border-surface-3 rounded-xl shadow-xl py-2 z-50 animate-fade-in">
          {/* User info */}
          <div className="px-4 py-3 border-b border-surface-3">
            <p className="text-sm font-medium text-white">
              {user?.username ?? 'User'}
            </p>
            <p className="text-xs text-zinc-400">{user?.email ?? ''}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-surface-2 transition-colors"
            >
              个人设置
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-surface-2 transition-colors"
            >
              API 密钥
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-300 hover:bg-surface-2 transition-colors"
            >
              偏好设置
            </Link>
          </div>

          <div className="border-t border-surface-3 py-1">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-2 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
