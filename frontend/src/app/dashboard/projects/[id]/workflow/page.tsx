'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { ReactFlowProvider } from 'reactflow';
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
    <div className="h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-surface-3">
      <ReactFlowProvider>
        <WorkflowEditor projectId={id} workflowId="default" />
      </ReactFlowProvider>
    </div>
  );
}
