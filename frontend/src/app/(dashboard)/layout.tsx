'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ToastProvider } from '@/components/ui/toast';
import { useWebSocket } from '@/lib/hooks/use-websocket';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Connect to WebSocket for real-time updates
  useWebSocket();

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-surface-0 p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
