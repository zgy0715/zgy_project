// Workflow state management with Zustand

import { create } from 'zustand';
import type {
  Workflow,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowEdge,
  WorkflowExecution,
} from '@/types';
import { workflowsApi } from '@/lib/api-client';
import { asArray, getErrorMessage } from '@/lib/utils';

// A run is considered lost if no terminal event arrives within this window;
// this stops `isExecuting` from latching on forever when WebSocket events are
// missed (disconnect, backend restart, ...).
const EXECUTION_GUARD_MS = 5 * 60 * 1000;
let executionGuardTimer: ReturnType<typeof setTimeout> | null = null;

function clearExecutionGuard(): void {
  if (executionGuardTimer) {
    clearTimeout(executionGuardTimer);
    executionGuardTimer = null;
  }
}

function startExecutionGuard(workflowId: string): void {
  clearExecutionGuard();
  executionGuardTimer = setTimeout(() => {
    executionGuardTimer = null;
    const state = useWorkflowStore.getState();
    if (state.isExecuting && state.currentWorkflow?.id === workflowId) {
      useWorkflowStore.setState({
        isExecuting: false,
        error: '工作流执行超时，未收到实时事件，已解除执行中状态',
      });
    }
  }, EXECUTION_GUARD_MS);
}

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  selectedNodeId: string | null;
  execution: WorkflowExecution | null;
  isExecuting: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  removeWorkflow: (id: string) => void;
  setCurrentWorkflow: (workflow: Workflow | null) => void;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;

  // Edge operations
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;

  // Execution
  setExecution: (execution: WorkflowExecution | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  runWorkflow: () => void;
  pauseWorkflow: () => void;
  resumeWorkflow: () => void;
  resetWorkflow: () => void;

  // API actions
  fetchWorkflows: (projectId?: string) => Promise<void>;
  fetchWorkflow: (projectId: string, id: string) => Promise<void>;
  saveWorkflow: (projectId: string) => Promise<void>;
  executeWorkflow: (projectId: string) => Promise<void>;
  createWorkflow: (data: Partial<Workflow>) => Promise<boolean>;
  deleteWorkflow: (id: string) => Promise<boolean>;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  selectedNodeId: null,
  execution: null,
  isExecuting: false,
  isPaused: false,
  isLoading: false,
  error: null,

  setWorkflows: (workflows) => set({ workflows, isLoading: false }),

  addWorkflow: (workflow) =>
    set((state) => ({ workflows: [...state.workflows, workflow] })),

  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
      currentWorkflow:
        state.currentWorkflow?.id === id
          ? { ...state.currentWorkflow, ...updates }
          : state.currentWorkflow,
    })),

  removeWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      currentWorkflow:
        state.currentWorkflow?.id === id ? null : state.currentWorkflow,
    })),

  setCurrentWorkflow: (currentWorkflow) => set({ currentWorkflow }),

  addNode: (node) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: [...state.currentWorkflow.nodes, node],
        },
      };
    }),

  updateNode: (id, data) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...(n.data ?? {}), ...data } } : n
          ),
        },
      };
    }),

  removeNode: (id) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.filter((n) => n.id !== id),
          edges: state.currentWorkflow.edges.filter(
            (e) => e.source !== id && e.target !== id
          ),
        },
      };
    }),

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  addEdge: (edge) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: [...state.currentWorkflow.edges, edge],
        },
      };
    }),

  removeEdge: (id) =>
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: state.currentWorkflow.edges.filter((e) => (e.id ?? `${e.source}-${e.target}`) !== id),
        },
      };
    }),

  setExecution: (execution) => set({ execution }),
  setExecuting: (isExecuting) => {
    if (!isExecuting) clearExecutionGuard();
    set({ isExecuting });
  },

  runWorkflow: () => {
    const { currentWorkflow, isExecuting } = get();
    if (!currentWorkflow || isExecuting) return;

    get().executeWorkflow(currentWorkflow.projectId ?? '');
  },

  pauseWorkflow: () => {
    const { isExecuting, isPaused, currentWorkflow } = get();
    if (!isExecuting || isPaused) return;

    // Local UI state only - backend doesn't support pause/resume
    set({
      isPaused: true,
      currentWorkflow: currentWorkflow
        ? { ...currentWorkflow, status: 'paused' as const }
        : null,
    });
  },

  resumeWorkflow: () => {
    const { isExecuting, isPaused, currentWorkflow } = get();
    if (!isExecuting || !isPaused) return;

    // Local UI state only - real-time updates continue via WebSocket
    set({
      isPaused: false,
      currentWorkflow: currentWorkflow
        ? { ...currentWorkflow, status: 'running' as const }
        : null,
    });
  },

  resetWorkflow: () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    // Reset all node statuses to idle locally
    const resetNodes = currentWorkflow.nodes.map((n) => ({
      ...n,
      data: { ...(n.data ?? {}), status: 'pending' as const },
    }));

    set({
      currentWorkflow: {
        ...currentWorkflow,
        nodes: resetNodes,
        status: 'created',
      },
      execution: null,
      isExecuting: false,
      isPaused: false,
    });
  },

  fetchWorkflows: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      // The gateway list endpoint has no project filter; scope client-side.
      const response = await workflowsApi.list();
      const allWorkflows = asArray<Workflow>(response.data.data);
      const workflows = projectId
        ? allWorkflows.filter(
            (w) => !w.projectId || String(w.projectId) === String(projectId)
          )
        : allWorkflows;
      set({
        workflows,
        currentWorkflow: workflows[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取工作流列表失败'),
        isLoading: false,
      });
    }
  },

  fetchWorkflow: async (projectId, id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await workflowsApi.detail(id);
      set({ currentWorkflow: response.data.data, isLoading: false });
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取工作流详情失败'),
        isLoading: false,
      });
    }
  },

  saveWorkflow: async (projectId) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    set({ isLoading: true, error: null });
    try {
      await workflowsApi.save(currentWorkflow.id, {
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        nodes: currentWorkflow.nodes,
        edges: currentWorkflow.edges,
      });
      set({ isLoading: false });
    } catch (error) {
      set({
        error: getErrorMessage(error, '保存工作流失败'),
        isLoading: false,
      });
    }
  },

  executeWorkflow: async (projectId) => {
    const { currentWorkflow, isExecuting } = get();
    if (!currentWorkflow || isExecuting) return;

    const workflowId = currentWorkflow.id;
    set({ isExecuting: true, isPaused: false, error: null });
    try {
      const response = await workflowsApi.execute(workflowId);
      const execution = response.data.data;
      const finalStatus =
        execution?.status === 'completed' || execution?.status === 'failed'
          ? execution.status
          : null;

      set((state) => ({
        execution,
        currentWorkflow: state.currentWorkflow
          ? { ...state.currentWorkflow, status: finalStatus ?? 'running' }
          : state.currentWorkflow,
        isExecuting: finalStatus === null,
      }));

      if (finalStatus === null) {
        // Real-time node updates keep coming via WebSocket (use-websocket hook);
        // the guard frees the button if they never arrive.
        startExecutionGuard(workflowId);
      } else {
        clearExecutionGuard();
      }
    } catch (error) {
      clearExecutionGuard();
      set({
        error: getErrorMessage(error, '执行工作流失败'),
        isExecuting: false,
      });
    }
  },

  createWorkflow: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await workflowsApi.create(data);
      const newWorkflow = response.data.data;
      set((state) => ({
        workflows: [...state.workflows, newWorkflow],
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '创建工作流失败'),
        isLoading: false,
      });
      return false;
    }
  },

  deleteWorkflow: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await workflowsApi.delete(id);
      get().removeWorkflow(id);
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '删除工作流失败'),
        isLoading: false,
      });
      return false;
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
