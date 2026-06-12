// Agent-related type definitions for DeepAgent platform

export type AgentType = 'coder' | 'reviewer' | 'tester' | 'deployer' | 'coordinator';

export type AgentStatus = 'pending' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed' | 'cancelled';

export interface Agent {
  id: string;
  name: string;
  agentType: AgentType;
  status: AgentStatus;
  description: string;
  avatar?: string;
  capabilities?: string[];
  model?: string;
  projectId?: string;
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
  agentId?: string;
  projectId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  latency?: number;
  finishReason?: string;
}

export interface ThinkingStep {
  step: string;
  thought: string;
  action?: string;
  actionInput?: string;
  observation?: string;
  timestamp: string;
  // Frontend-only fields
  id?: string;
  agentId?: string;
  messageId?: string;
}

export interface ThinkingChain {
  agentId: string;
  agentType: string;
  steps: ThinkingStep[];
  totalSteps: number;
  // Frontend-only fields
  id?: string;
  messageId?: string;
  finalAnswer?: string;
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
