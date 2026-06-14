'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">DA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">忘记密码</h1>
          <p className="text-sm text-zinc-400 mt-2">
            输入您的邮箱地址，我们将发送密码重置链接
          </p>
        </div>

        {submitted ? (
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg px-4 py-3 text-sm text-green-400">
            如果该邮箱已注册，重置链接将发送到您的邮箱
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              label="邮箱地址"
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Button type="submit" className="w-full">
              发送重置链接
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-400">
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
