// Agent-related type definitions for DeepAgent platform

export type AgentType = 'planner' | 'coder' | 'reviewer' | 'tester' | 'deployer' | 'custom';

export type AgentStatus = 'idle' | 'thinking' | 'running' | 'success' | 'error' | 'waiting';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  description: string;
  avatar?: string;
  capabilities: string[];
  model: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  id: string;
  agentId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  memoryEnabled: boolean;
  maxIterations: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId: string;
  projectId: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  latency?: number;
  finishReason?: string;
}

export interface ThinkingStep {
  id: string;
  agentId: string;
  messageId: string;
  step: number;
  thought: string;
  action?: string;
  actionInput?: string;
  observation?: string;
  timestamp: string;
}

export interface ThinkingChain {
  id: string;
  messageId: string;
  agentId: string;
  steps: ThinkingStep[];
  finalAnswer?: string;
  totalTokens?: number;
  duration?: number;
}

export interface AgentConversation {
  id: string;
  agentId: string;
  projectId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalTasks: number;
  successRate: number;
  avgLatency: number;
  totalTokens: number;
  lastActiveAt: string;
}
