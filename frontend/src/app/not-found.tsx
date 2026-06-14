import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="text-8xl font-bold text-brand-600">404</div>
        <h1 className="text-2xl font-bold text-white">页面未找到</h1>
        <p className="text-zinc-400 max-w-md mx-auto">
          您访问的页面不存在或已被移除。请检查URL是否正确，或返回首页。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-lg bg-surface-2 border border-surface-3 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-surface-3 transition-colors"
          >
            返回首页
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition-colors"
          >
            进入控制台
          </Link>
        </div>
      </div>
    </div>
  );
}
