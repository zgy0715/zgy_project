'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { API_MODE } from '@/lib/constants';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const apiMode = API_MODE;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const handleSaveProfile = () => {
    if (user) {
      setUser({ ...user, username, email });
      alert('个人资料已保存');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          管理你的账户和平台配置
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Role
              </label>
              <p className="text-sm text-zinc-400">
                <Badge variant="secondary">{user?.role ?? 'user'}</Badge>
              </p>
            </div>
            <Button className="mt-2" onClick={handleSaveProfile}>保存资料</Button>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            API Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                API Mode
              </label>
              <div className="flex items-center gap-3">
                <span className="rounded-lg px-4 py-2 text-sm font-medium bg-brand-600 text-white">
                  {apiMode === 'mock' ? 'Mock' : 'API'}
                </span>
                <span className="text-xs text-zinc-500">
                  {apiMode === 'mock'
                    ? 'Using local mock data'
                    : 'Using real backend API'}
                  {' '}(构建时确定，运行时不可修改)
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                API Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                readOnly
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-zinc-400 placeholder-zinc-500 cursor-not-allowed opacity-50"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Base URL 由环境变量 NEXT_PUBLIC_API_BASE_URL 决定
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Preferences */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Theme Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Theme
              </label>
              <div className="flex items-center gap-3">
                <span className="rounded-lg px-4 py-2 text-sm font-medium bg-brand-600 text-white">
                  Dark
                </span>
                <span className="text-xs text-zinc-500">
                  当前主题为 Dark（构建时确定，运行时不可修改）
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
