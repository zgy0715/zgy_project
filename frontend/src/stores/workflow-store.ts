// Workflow state management with Zustand - dual mode (mock/api) support

import { create } from 'zustand';
import type {
  Workflow,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowEdge,
  WorkflowExecution,
} from '@/types';
import { mockWorkflow } from '@/lib/mock-data';
import { API_MODE } from '@/lib/constants';
import { workflowsApi } from '@/lib/api-client';

const apiMode = API_MODE;

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  selectedNodeId: string | null;
  execution: WorkflowExecution | null;
  isExecuting: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;

  // Execution control state (moved from module-level variables)
  executionTimeouts: ReturnType<typeof setTimeout>[];
  currentExecutionIndex: number;
  isExecutionPaused: boolean;

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

  // API mode actions
  fetchWorkflows: (projectId: string) => Promise<void>;
  fetchWorkflow: (projectId: string, id: string) => Promise<void>;
  saveWorkflow: (projectId: string) => Promise<void>;
  executeWorkflow: (projectId: string) => Promise<void>;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Execution order following the DAG: Start → Coder → Reviewer → Condition → Tester → Deployer → End
const executionOrder = [
  'node-start',
  'node-coder',
  'node-reviewer',
  'node-condition',
  'node-tester',
  'node-deployer',
  'node-end',
];

// Track timeout IDs for pause/resume in mock mode
// (moved into store state: executionTimeouts, currentExecutionIndex, isExecutionPaused)

function clearExecutionTimeouts(timeouts: ReturnType<typeof setTimeout>[]) {
  timeouts.forEach((t) => clearTimeout(t));
}

// In mock mode, initialize with mock workflow data
const mockDefaults = {
  workflows: [mockWorkflow],
  currentWorkflow: mockWorkflow,
};

// In API mode, start empty (data will be fetched)
const apiDefaults = {
  workflows: [],
  currentWorkflow: null,
};

const defaults = apiMode === 'mock' ? mockDefaults : apiDefaults;

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  ...defaults,
  selectedNodeId: null,
  execution: null,
  isExecuting: false,
  isPaused: false,
  isLoading: false,
  error: null,
  executionTimeouts: [],
  currentExecutionIndex: 0,
  isExecutionPaused: false,

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
  setExecuting: (isExecuting) => set({ isExecuting }),

  runWorkflow: () => {
    const { currentWorkflow, isExecuting } = get();
    if (!currentWorkflow || isExecuting) return;

    if (apiMode === 'api') {
      // API mode: delegate to executeWorkflow which calls the API
      get().executeWorkflow(currentWorkflow.projectId ?? '');
      return;
    }

    // Mock mode: simulate execution with timed node status updates
    clearExecutionTimeouts(get().executionTimeouts);
    const executionId = `exec-${Date.now()}`;
    const nodeExecutions = executionOrder.map((nodeId) => ({
      nodeId,
      status: 'pending' as const,
    }));

    const newTimeouts: ReturnType<typeof setTimeout>[] = [];

    set({
      isExecuting: true,
      isPaused: false,
      isExecutionPaused: false,
      currentExecutionIndex: 0,
      executionTimeouts: newTimeouts,
      execution: {
        id: executionId,
        workflowId: currentWorkflow.id,
        status: 'running',
        startedAt: new Date().toISOString(),
        results: {},
        nodeExecutions,
      },
      currentWorkflow: {
        ...currentWorkflow,
        status: 'running',
      },
    });

    // Execute nodes sequentially with 2-second intervals
    executionOrder.forEach((nodeId, index) => {
      // Phase 1: Set node to thinking (after delay)
      const t1 = setTimeout(() => {
        if (get().isExecutionPaused) return;
        get().updateNode(nodeId, { status: 'planning' });
        get().setExecution({
          ...get().execution!,
          nodeExecutions: get().execution!.nodeExecutions?.map((ne) =>
            ne.nodeId === nodeId ? { ...ne, status: 'running' as const, startedAt: new Date().toISOString() } : ne
          ),
        });
      }, index * 2000);
      set({ executionTimeouts: [...get().executionTimeouts, t1] });

      // Phase 2: Set node to running
      const t2 = setTimeout(() => {
        if (get().isExecutionPaused) return;
        get().updateNode(nodeId, { status: 'executing' });
      }, index * 2000 + 600);
      set({ executionTimeouts: [...get().executionTimeouts, t2] });

      // Phase 3: Set node to success
      const t3 = setTimeout(() => {
        if (get().isExecutionPaused) return;
        get().updateNode(nodeId, { status: 'completed' });
        get().setExecution({
          ...get().execution!,
          nodeExecutions: get().execution!.nodeExecutions?.map((ne) =>
            ne.nodeId === nodeId
              ? { ...ne, status: 'completed' as const, completedAt: new Date().toISOString() }
              : ne
          ),
        });

        // If this is the last node, mark execution as completed
        if (index === executionOrder.length - 1) {
          const currentWf = get().currentWorkflow;
          if (currentWf) {
            set({
              isExecuting: false,
              isPaused: false,
              currentWorkflow: { ...currentWf, status: 'completed' },
              execution: {
                ...get().execution!,
                status: 'completed',
                completedAt: new Date().toISOString(),
              },
            });
          }
        }
      }, index * 2000 + 1500);
      set({ executionTimeouts: [...get().executionTimeouts, t3] });
    });
  },

  pauseWorkflow: () => {
    const { isExecuting, isPaused, currentWorkflow, executionTimeouts } = get();
    if (!isExecuting || isPaused) return;

    if (apiMode === 'api') {
      // API mode: update local state only (backend doesn't support pause/resume)
      // The workflow continues on the backend, but UI shows paused state
      set({
        isPaused: true,
        currentWorkflow: currentWorkflow
          ? { ...currentWorkflow, status: 'paused' as const }
          : null,
      });
    } else {
      // Mock mode: clear all pending timeouts to pause execution
      clearExecutionTimeouts(executionTimeouts);
      set({
        isPaused: true,
        isExecutionPaused: true,
        executionTimeouts: [],
        currentExecutionIndex: 0,
        currentWorkflow: currentWorkflow
          ? { ...currentWorkflow, status: 'paused' as const }
          : null,
        execution: get().execution
          ? { ...get().execution!, status: 'running' as const }
          : null,
      });
    }
  },

  resumeWorkflow: () => {
    const { isExecuting, isPaused, currentWorkflow } = get();
    if (!isExecuting || !isPaused) return;

    if (apiMode === 'api') {
      // API mode: just update local state back to running
      // Real-time updates will continue via WebSocket
      set({
        isPaused: false,
        currentWorkflow: currentWorkflow
          ? { ...currentWorkflow, status: 'running' as const }
          : null,
      });
    } else {
      // Mock mode: re-schedule remaining nodes from where we left off
      set({ isExecutionPaused: false });

      // Find the next node to execute (first non-success node)
      const execution = get().execution;
      if (!execution || !currentWorkflow) return;

      const nextIndex = execution.nodeExecutions?.findIndex(
        (ne) => ne.status === 'pending'
      ) ?? -1;
      if (nextIndex === -1) return;

      set({
        isPaused: false,
        currentExecutionIndex: nextIndex,
        currentWorkflow: { ...currentWorkflow, status: 'running' },
      });

      // Resume from the next pending node
      for (let i = nextIndex; i < executionOrder.length; i++) {
        const nodeId = executionOrder[i];
        const delay = (i - nextIndex) * 2000;

        const t1 = setTimeout(() => {
          if (get().isExecutionPaused) return;
          get().updateNode(nodeId, { status: 'planning' });
          get().setExecution({
            ...get().execution!,
            nodeExecutions: get().execution!.nodeExecutions?.map((ne) =>
              ne.nodeId === nodeId ? { ...ne, status: 'running' as const, startedAt: new Date().toISOString() } : ne
            ),
          });
        }, delay);
        set({ executionTimeouts: [...get().executionTimeouts, t1] });

        const t2 = setTimeout(() => {
          if (get().isExecutionPaused) return;
          get().updateNode(nodeId, { status: 'executing' });
        }, delay + 600);
        set({ executionTimeouts: [...get().executionTimeouts, t2] });

        const t3 = setTimeout(() => {
          if (get().isExecutionPaused) return;
          get().updateNode(nodeId, { status: 'completed' });
          get().setExecution({
            ...get().execution!,
            nodeExecutions: get().execution!.nodeExecutions?.map((ne) =>
              ne.nodeId === nodeId
                ? { ...ne, status: 'completed' as const, completedAt: new Date().toISOString() }
                : ne
            ),
          });

          if (i === executionOrder.length - 1) {
            const currentWf = get().currentWorkflow;
            if (currentWf) {
              set({
                isExecuting: false,
                isPaused: false,
                currentWorkflow: { ...currentWf, status: 'completed' },
                execution: {
                  ...get().execution!,
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                },
              });
            }
          }
        }, delay + 1500);
        set({ executionTimeouts: [...get().executionTimeouts, t3] });
      }
    }
  },

  resetWorkflow: () => {
    const { currentWorkflow, executionTimeouts } = get();
    if (!currentWorkflow) return;

    // Clear any pending execution timeouts
    clearExecutionTimeouts(executionTimeouts);

    // Reset all node statuses to idle
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
      executionTimeouts: [],
      currentExecutionIndex: 0,
      isExecutionPaused: false,
    });
  },

  fetchWorkflows: async (projectId) => {
    if (apiMode === 'mock') {
      // Mock mode: workflows already loaded
      return;
    }

    // API mode: fetch workflows from backend
    set({ isLoading: true, error: null });
    try {
      const response = await workflowsApi.list();
      const workflows = response.data.data;
      set({
        workflows,
        currentWorkflow: workflows[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch workflows';
      set({ error: message, isLoading: false });
    }
  },

  fetchWorkflow: async (projectId, id) => {
    if (apiMode === 'mock') {
      // Mock mode: find workflow from local state
      const workflow = get().workflows.find((w) => w.id === id);
      if (workflow) {
        set({ currentWorkflow: workflow });
      }
      return;
    }

    // API mode: fetch workflow detail from backend
    set({ isLoading: true, error: null });
    try {
      const response = await workflowsApi.detail(id);
      set({ currentWorkflow: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch workflow';
      set({ error: message, isLoading: false });
    }
  },

  saveWorkflow: async (projectId) => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    if (apiMode === 'mock') {
      // Mock mode: workflow is already saved locally
      return;
    }

    // API mode: save workflow to backend
    set({ isLoading: true, error: null });
    try {
      await workflowsApi.save(currentWorkflow.id, {
        nodes: currentWorkflow.nodes,
        edges: currentWorkflow.edges,
      });
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save workflow';
      set({ error: message, isLoading: false });
    }
  },

  executeWorkflow: async (projectId) => {
    const { currentWorkflow, isExecuting } = get();
    if (!currentWorkflow || isExecuting) return;

    if (apiMode === 'mock') {
      // Mock mode: use the simulated runWorkflow
      get().runWorkflow();
      return;
    }

    // API mode: execute workflow via API, then listen for WebSocket updates
    set({ isExecuting: true, isPaused: false, error: null });
    try {
      const response = await workflowsApi.execute(currentWorkflow.id);
      const execution = response.data.data;
      set({
        execution,
        currentWorkflow: { ...currentWorkflow, status: 'running' },
      });
      // Real-time node status updates will come via WebSocket (use-websocket hook)
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to execute workflow';
      set({ error: message, isExecuting: false });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
