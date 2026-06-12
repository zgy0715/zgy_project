// Workflow state management with Zustand

import { create } from 'zustand';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowNodeData,
} from '@/types';
import { mockWorkflow } from '@/lib/mock-data';

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  selectedNodeId: string | null;
  execution: WorkflowExecution | null;
  isExecuting: boolean;
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
  resetWorkflow: () => void;

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

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  workflows: [mockWorkflow],
  currentWorkflow: mockWorkflow,
  selectedNodeId: null,
  execution: null,
  isExecuting: false,
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
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
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
          edges: state.currentWorkflow.edges.filter((e) => e.id !== id),
        },
      };
    }),

  setExecution: (execution) => set({ execution }),
  setExecuting: (isExecuting) => set({ isExecuting }),

  runWorkflow: () => {
    const { currentWorkflow, isExecuting } = get();
    if (!currentWorkflow || isExecuting) return;

    // Create execution record
    const executionId = `exec-${Date.now()}`;
    const nodeExecutions = executionOrder.map((nodeId) => ({
      nodeId,
      status: 'pending' as const,
    }));

    set({
      isExecuting: true,
      execution: {
        id: executionId,
        workflowId: currentWorkflow.id,
        status: 'running',
        startedAt: new Date().toISOString(),
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
      setTimeout(() => {
        get().updateNode(nodeId, { status: 'thinking' });
        get().setExecution({
          ...get().execution!,
          nodeExecutions: get().execution!.nodeExecutions.map((ne) =>
            ne.nodeId === nodeId ? { ...ne, status: 'running' as const, startedAt: new Date().toISOString() } : ne
          ),
        });
      }, index * 2000);

      // Phase 2: Set node to running
      setTimeout(() => {
        get().updateNode(nodeId, { status: 'running' });
      }, index * 2000 + 600);

      // Phase 3: Set node to success
      setTimeout(() => {
        get().updateNode(nodeId, { status: 'success' });
        get().setExecution({
          ...get().execution!,
          nodeExecutions: get().execution!.nodeExecutions.map((ne) =>
            ne.nodeId === nodeId
              ? { ...ne, status: 'success' as const, completedAt: new Date().toISOString() }
              : ne
          ),
        });

        // If this is the last node, mark execution as completed
        if (index === executionOrder.length - 1) {
          const currentWf = get().currentWorkflow;
          if (currentWf) {
            set({
              isExecuting: false,
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
    });
  },

  resetWorkflow: () => {
    const { currentWorkflow } = get();
    if (!currentWorkflow) return;

    // Reset all node statuses to idle
    const resetNodes = currentWorkflow.nodes.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle' as const },
    }));

    set({
      currentWorkflow: {
        ...currentWorkflow,
        nodes: resetNodes,
        status: 'draft',
      },
      execution: null,
      isExecuting: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
