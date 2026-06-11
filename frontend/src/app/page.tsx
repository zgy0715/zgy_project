import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-surface-3 bg-surface-0/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">DA</span>
            </div>
            <span className="text-xl font-bold text-white">DeepAgent</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-4xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-surface-2 border border-surface-3 rounded-full px-4 py-1.5 text-sm text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Multi-Agent AI Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="text-white">Build with </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-violet-400">
              AI Agents
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            DeepAgent orchestrates multiple AI agents that plan, code, review,
            test, and deploy together. Transform your development workflow with
            intelligent collaboration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors w-full sm:w-auto"
            >
              Start Building
            </Link>
            <Link
              href="/dashboard"
              className="border border-surface-3 hover:border-surface-4 text-zinc-300 px-8 py-3 rounded-lg text-lg font-medium transition-colors w-full sm:w-auto"
            >
              View Demo
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-6xl mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 pb-24">
          {[
            {
              title: 'Workflow Orchestration',
              description:
                'Design DAG-based workflows that coordinate multiple AI agents with visual editor.',
              icon: '🔄',
            },
            {
              title: 'Real-time Collaboration',
              description:
                'Watch agents think, code, and iterate in real-time with full transparency.',
              icon: '⚡',
            },
            {
              title: 'Code Generation',
              description:
                'Agents write, review, and test production-ready code with built-in quality checks.',
              icon: '🛠️',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-surface-1 border border-surface-3 rounded-xl p-6 hover:border-brand-500/50 transition-colors"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-3 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-zinc-500">
          © 2024 DeepAgent. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
