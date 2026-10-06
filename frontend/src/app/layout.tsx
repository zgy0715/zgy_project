import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import ErrorBoundary from '@/components/error-boundary';
import { STORAGE_KEYS } from '@/lib/constants';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DeepAgent - Multi-AI Agent Collaborative Development Platform',
  description:
    'Build software with multiple AI agents collaborating in real-time. Plan, code, review, test, and deploy with intelligent automation.',
  keywords: ['AI', 'Agent', 'Development', 'Collaboration', 'Automation'],
};

// Runs before the rest of the body is parsed, so the persisted theme is applied
// before the first paint instead of after hydration (which flashed dark for
// light-theme users). The logic mirrors app/dashboard/settings/page.tsx: the
// default when nothing is stored is 'dark'.
const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEYS.THEME}')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-surface-0 text-white`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
