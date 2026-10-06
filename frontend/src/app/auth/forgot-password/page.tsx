'use client';

import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">DA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">忘记密码</h1>
        </div>

        {/*
          There is no password-reset endpoint in the gateway (AuthController only
          exposes /register, /login, /refresh, /logout, /me), so this page must not
          pretend to send a reset link.
        */}
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg px-4 py-3 text-sm text-amber-400">
          密码重置暂未开放：后端尚未提供重置接口，无法通过邮箱自助找回密码，请联系管理员重置。
        </div>

        <p className="text-center text-sm text-zinc-400">
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
