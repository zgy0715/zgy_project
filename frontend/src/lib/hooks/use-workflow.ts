// Workflow hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
  Workflow,
  WorkflowExecution,
  ApiResponse,
} from '@/types';

export function useWorkflow(projectId: string) {
  const {
    workflows,
    currentWorkflow,
    selectedNodeId,
    execution,
    isExecuting,
    isLoading,
    error,
    setWorkflows,
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

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ApiResponse<Workflow[]>>(
        API_ENDPOINTS.WORKFLOWS.LIST(projectId)
      );
      setWorkflows(response.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch workflows';
      setError(message);
    }
  }, [projectId, setWorkflows, setLoading, setError]);

  const fetchWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        setLoading(true);
        const response = await apiClient.get<ApiResponse<Workflow>>(
          API_ENDPOINTS.WORKFLOWS.DETAIL(projectId, workflowId)
        );
        setCurrentWorkflow(response.data.data);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to fetch workflow';
        setError(message);
      }
    },
    [projectId, setCurrentWorkflow, setLoading, setError]
  );

  const saveWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    try {
      await apiClient.put(
        API_ENDPOINTS.WORKFLOWS.DETAIL(projectId, currentWorkflow.id),
        {
          nodes: currentWorkflow.nodes,
          edges: currentWorkflow.edges,
        }
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save workflow';
      setError(message);
    }
  }, [projectId, currentWorkflow, setError]);

  const executeWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    try {
      setExecuting(true);
      const response = await apiClient.post<ApiResponse<WorkflowExecution>>(
        API_ENDPOINTS.WORKFLOWS.EXECUTE(projectId, currentWorkflow.id)
      );
      setExecution(response.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to execute workflow';
      setError(message);
    } finally {
      setExecuting(false);
    }
  }, [projectId, currentWorkflow, setExecution, setExecuting, setError]);

  return {
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
    clearError,
  };
}
