'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { STORAGE_KEYS } from '@/lib/constants';

type Theme = 'dark' | 'light' | 'system';

const MIN_PASSWORD_LENGTH = 8; // matches the gateway's @Size(min = 8)

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Start from the server-safe default and read localStorage after mount so the
  // server and client markup match on the first render.
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME) as Theme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      setTheme(stored);
    }
  }, []);

  // Apply the theme and register exactly one system-preference listener, which
  // is removed when the theme changes or the component unmounts.
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (value: Theme) => {
      root.classList.toggle('dark', value === 'dark' || (value === 'system' && mediaQuery.matches));
    };

    apply(theme);

    if (theme !== 'system') return;

    const handler = (e: MediaQueryListEvent) => {
      root.classList.toggle('dark', e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    clearError();
    const saved = await updateProfile({
      username: username.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (saved) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  const handleChangePassword = async () => {
    clearError();
    setPasswordError('');
    setPasswordSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`新密码至少${MIN_PASSWORD_LENGTH}个字符`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    const saved = await changePassword({
      oldPassword: currentPassword,
      newPassword,
    });
    if (!saved) return;

    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 2000);
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

      {/* Error banner */}
      {storeError && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          {storeError}
        </div>
      )}

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
              <Button onClick={handleSaveProfile} disabled={isLoading}>
                保存资料
              </Button>
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
                placeholder={`至少${MIN_PASSWORD_LENGTH}个字符`}
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
              <Button onClick={handleChangePassword} disabled={isLoading}>
                修改密码
              </Button>
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
