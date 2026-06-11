'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';

// Dynamically import ReactFlow to avoid SSR issues
const WorkflowEditor = dynamic(
  () => import('@/components/workflow/workflow-editor').then((mod) => mod.WorkflowEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px]">
        <Spinner size="lg" />
      </div>
    ),
  }
);

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Workflow Editor</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Design and manage your agent workflow DAG
        </p>
      </div>

      {/* Workflow editor */}
      <div className="h-[calc(100vh-200px)]">
        <WorkflowEditor projectId={id} workflowId="default" />
      </div>
    </div>
  );
}
