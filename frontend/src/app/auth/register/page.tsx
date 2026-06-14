'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/hooks/use-auth';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { register, isLoading, error, clearError } = useAuth();

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (username.length < 3 || username.length > 100) {
      errors.username = '用户名长度需在3-100个字符之间';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = '请输入有效的邮箱地址';
    }

    if (password.length < 8 || password.length > 128) {
      errors.password = '密码长度需在8-128个字符之间';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    await register({ username, email, password });
  };

  const handleFieldChange = (
    field: keyof FieldErrors,
    setter: (val: string) => void,
    value: string
  ) => {
    setter(value);
    clearError();
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
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

      {/* Right: Register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white">注册</h2>
            <p className="text-sm text-zinc-400 mt-2">
              创建您的 DeepAgent 账号
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
              onChange={(e) => handleFieldChange('username', setUsername, e.target.value)}
              error={fieldErrors.username}
              required
              autoComplete="username"
            />

            <Input
              id="email"
              label="邮箱"
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => handleFieldChange('email', setEmail, e.target.value)}
              error={fieldErrors.email}
              required
              autoComplete="email"
            />

            <Input
              id="password"
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => handleFieldChange('password', setPassword, e.target.value)}
              error={fieldErrors.password}
              required
              autoComplete="new-password"
            />

            <Input
              id="confirmPassword"
              label="确认密码"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', setConfirmPassword, e.target.value)}
              error={fieldErrors.confirmPassword}
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : '注册'}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-400">
            已有账号？{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
