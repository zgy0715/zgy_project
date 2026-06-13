// Workflow hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { Workflow, WorkflowExecution } from '@/types';

export function useWorkflow(projectId?: string) {
  const {
    workflows,
    currentWorkflow,
    selectedNodeId,
    execution,
    isExecuting,
    isLoading,
    error,
    fetchWorkflows,
    fetchWorkflow,
    saveWorkflow,
    executeWorkflow,
    setCurrentWorkflow,
    addNode,
    updateNode,
    removeNode,
    selectNode,
    addEdge,
    removeEdge,
    setExecution,
    setExecuting,
    setLoading,
    setError,
    clearError,
  } = useWorkflowStore();

  const fetchWorkflowsList = useCallback(async () => {
    if (projectId) {
      await fetchWorkflows(projectId);
    }
  }, [fetchWorkflows, projectId]);

  const fetchWorkflowDetail = useCallback(
    async (workflowId: string) => {
      if (projectId) {
        await fetchWorkflow(projectId, workflowId);
      }
    },
    [fetchWorkflow, projectId]
  );

  const saveCurrentWorkflow = useCallback(async () => {
    if (projectId) {
      await saveWorkflow(projectId);
    }
  }, [saveWorkflow, projectId]);

  const executeCurrentWorkflow = useCallback(async () => {
    if (projectId) {
      await executeWorkflow(projectId);
    }
  }, [executeWorkflow, projectId]);

  return {
    workflows,
    currentWorkflow,
    selectedNodeId,
    execution,
    isExecuting,
    isLoading,
    error,
    fetchWorkflows: fetchWorkflowsList,
    fetchWorkflow: fetchWorkflowDetail,
    saveWorkflow: saveCurrentWorkflow,
    executeWorkflow: executeCurrentWorkflow,
    setCurrentWorkflow,
    addNode,
    updateNode,
    removeNode,
    selectNode,
    addEdge,
    removeEdge,
    setExecution,
    setExecuting,
    clearError,
  };
}
