'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/hooks/use-auth';
import { API_MODE } from '@/lib/constants';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();
  const router = useRouter();

  const isMock = API_MODE === 'mock';

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login({ username, password });
  };

  const handleDemoLogin = async () => {
    await login({ username: 'demo', password: 'demo' });
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
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-sm text-zinc-400 mt-2">
              Welcome back! Enter your credentials to continue.
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
              label="Email / Username"
              type="text"
              placeholder="you@example.com"
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
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  className="rounded border-surface-3 bg-surface-1 text-brand-600 focus:ring-brand-500"
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-brand-400 hover:text-brand-300">
                Forgot password?
              </a>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : 'Sign In'}
            </Button>
          </form>

          {isMock && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-3" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface-0 px-3 text-zinc-500">Demo Mode</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full mt-4"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                Enter Demo Dashboard
              </Button>
              <p className="text-center text-xs text-zinc-500 mt-2">
                No credentials needed — click to explore with mock data
              </p>
            </div>
          )}

          <p className="text-center text-sm text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
