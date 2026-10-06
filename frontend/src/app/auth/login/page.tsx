'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/hooks/use-auth';
import { STORAGE_KEYS } from '@/lib/constants';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('/dashboard');
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();
  const router = useRouter();

  // Read the post-login destination and the remembered username after mount.
  // `window.location.search` is used instead of `useSearchParams()` so the page
  // does not need a Suspense boundary.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('callbackUrl');
    // Only accept same-site absolute paths — never an external redirect target.
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      setCallbackUrl(next);
    }

    const remembered = localStorage.getItem(STORAGE_KEYS.REMEMBERED_USERNAME);
    if (remembered) {
      setUsername(remembered);
      setRemember(true);
    }
  }, []);

  // If already authenticated, redirect to the requested page
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(callbackUrl);
    }
  }, [isAuthenticated, router, callbackUrl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBERED_USERNAME, username);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USERNAME);
    }
    await login({ username, password }, callbackUrl);
  };

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 to-surface-0 items-center justify-center p-12">
        <div className="max-w-md text-center space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-3xl">DA</span>
          </div>
          <h1 className="text-4xl font-bold text-white">DeepAgent</h1>
          <p className="text-lg text-zinc-400">
            多AI Agent协作开发平台
          </p>
          <div className="flex justify-center gap-6 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              4种Agent类型
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              实时协作
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              安全可靠
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white">登录</h2>
            <p className="text-sm text-zinc-400 mt-2">
              欢迎回来，请输入您的账号信息
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="username"
              label="用户名"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clearError();
              }}
              required
              autoComplete="username"
            />

            <Input
              id="password"
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-surface-3 bg-surface-1 text-brand-600 focus:ring-brand-500"
                />
                记住我
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-brand-400 hover:text-brand-300">
                忘记密码?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : '登录'}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-400">
            没有账号？{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300">
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
