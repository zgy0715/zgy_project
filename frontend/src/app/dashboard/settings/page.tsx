'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';

type Theme = 'dark' | 'light' | 'system';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [theme, setTheme] = useState<Theme>(
    (typeof window !== 'undefined' && localStorage.getItem('deepagent_theme') as Theme) || 'dark'
  );

  const handleSaveProfile = () => {
    if (user) {
      // TODO: 调用后端更新用户资料API (PUT /auth/profile)
      setUser({ ...user, username, email });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  const handleChangePassword = () => {
    setPasswordError('');
    setPasswordSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码至少6个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    // TODO: 调用后端修改密码API
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deepagent_theme', newTheme);
      const root = document.documentElement;
      if (newTheme === 'light') {
        root.classList.remove('dark');
      } else if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        // system mode: detect system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
          if (localStorage.getItem('deepagent_theme') === 'system') {
            if (e.matches) {
              root.classList.add('dark');
            } else {
              root.classList.remove('dark');
            }
          }
        };
        mediaQuery.addEventListener('change', handler);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <p className="text-sm text-zinc-400 mt-1">
          管理你的账户和平台配置
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">个人资料</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                用户名
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
                邮箱
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
                角色
              </label>
              <p className="text-sm text-zinc-400">
                <Badge variant="secondary">{user?.role ?? 'user'}</Badge>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveProfile}>保存资料</Button>
              {profileSaved && (
                <span className="text-sm text-green-400">已保存</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">修改密码</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                当前密码
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6个字符"
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full max-w-md rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleChangePassword} disabled>
                修改密码（开发中）
              </Button>
              <p className="text-xs text-zinc-500 mt-1">密码修改功能需要后端API支持</p>
              {passwordSaved && (
                <span className="text-sm text-green-400">密码已修改</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Preferences */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            主题偏好
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                主题
              </label>
              <div className="flex items-center gap-3">
                {(['dark', 'light', 'system'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border ${
                      theme === t
                        ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                        : 'border-surface-3 text-zinc-400 hover:border-surface-3 hover:bg-surface-2'
                    }`}
                  >
                    {t === 'dark' ? '深色' : t === 'light' ? '浅色' : '跟随系统'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
