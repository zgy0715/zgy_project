// Workflow-related type definitions for DeepAgent platform

export type NodeType = 'agent' | 'trigger' | 'condition' | 'parallel' | 'merge' | 'output';

export type EdgeType = 'default' | 'conditional' | 'parallel';

export type WorkflowStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowNode {
  id: string;
  agentType: string;
  name: string;
  config?: Record<string, unknown>;
  // Frontend-only fields for ReactFlow visualization
  type?: NodeType;
  position?: { x: number; y: number };
  data?: WorkflowNodeData;
}

export interface WorkflowNodeData {
  label?: string;
  agentId?: string;
  agentType?: string;
  config?: Record<string, unknown>;
  description?: string;
  status?: 'pending' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed';
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string;
  // Frontend-only fields for ReactFlow visualization
  id?: string;
  type?: EdgeType;
  label?: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  projectId?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  workflowId: string;
  status: WorkflowStatus;
  results: Record<string, unknown>;
  error?: string;
  // Frontend-only fields for execution tracking
  id?: string;
  startedAt?: string;
  completedAt?: string;
  nodeExecutions?: NodeExecution[];
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
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
