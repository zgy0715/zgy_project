// Central type exports for DeepAgent platform

// User & Auth types
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// API response wrapper
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// WebSocket event types
export interface WSEvent {
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface AgentMessageEvent {
  type: 'agent_message';
  payload: {
    agentId: string;
    messageId: string;
    content: string;
    isStreaming: boolean;
  };
}

export interface WorkflowUpdateEvent {
  type: 'workflow_update';
  payload: {
    workflowId: string;
    nodeId: string;
    status: string;
    output?: string;
  };
}

export interface AgentStatusEvent {
  type: 'agent_status';
  payload: {
    agentId: string;
    status: string;
  };
}

// Re-export domain types
export * from './agent';
export * from './workflow';
export * from './project';
