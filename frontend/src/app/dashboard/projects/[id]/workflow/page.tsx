'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ReactFlowProvider } from 'reactflow';
import { Spinner } from '@/components/ui/spinner';
import { useWorkflowStore } from '@/stores/workflow-store';

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
  params: { id: string };
}) {
  const { id } = params;
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows);

  // Load workflows for this project
  useEffect(() => {
    fetchWorkflows(id);
  }, [id, fetchWorkflows]);

  const workflowId = currentWorkflow?.id ?? 'default';

  return (
    <div className="h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-surface-3">
      <ReactFlowProvider>
        <WorkflowEditor projectId={id} workflowId={workflowId} />
      </ReactFlowProvider>
    </div>
  );
}
