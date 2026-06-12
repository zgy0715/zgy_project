// Workflow-related type definitions for DeepAgent platform

export type NodeType = 'agent' | 'trigger' | 'condition' | 'parallel' | 'merge' | 'output';

export type EdgeType = 'default' | 'conditional' | 'parallel';

export type WorkflowStatus = 'draft' | 'active' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowNodeData {
  label: string;
  agentId?: string;
  agentType?: string;
  config?: Record<string, unknown>;
  description?: string;
  status?: 'idle' | 'thinking' | 'running' | 'success' | 'error';
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: EdgeType;
  label?: string;
  condition?: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  nodeExecutions: NodeExecution[];
  error?: string;
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  thumbnail?: string;
}
