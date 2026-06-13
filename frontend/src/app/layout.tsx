import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import ErrorBoundary from '@/components/error-boundary';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-surface-0 text-white`}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
