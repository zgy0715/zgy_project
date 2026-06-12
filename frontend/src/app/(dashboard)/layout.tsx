'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/hooks/use-auth';
import { useWebSocket } from '@/lib/hooks/use-websocket';
import { ToastProvider } from '@/components/ui/toast';

// Extract projectId from pathname like /dashboard/projects/{id}/...
function extractProjectId(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const projectsIndex = segments.indexOf('projects');
  if (projectsIndex !== -1 && projectsIndex + 1 < segments.length) {
    const candidate = segments[projectsIndex + 1];
    // Skip if it's a known sub-path, not a project ID
    if (candidate && candidate !== 'new') {
      return candidate;
    }
  }
  return undefined;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Extract projectId from URL path like /dashboard/projects/{projectId}/...
  const projectId = extractProjectId(pathname);

  // Connect to WebSocket for real-time updates
  useWebSocket(projectId);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-surface-0 p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
