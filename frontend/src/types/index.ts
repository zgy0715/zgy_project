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
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  // /auth/me returns these as null (AuthResponse is @JsonInclude(NON_NULL)),
  // so callers must not assume a token is present.
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string;
  expiresIn: number;
  username: string;
  email: string;
  role: string;
}

// API response wrapper (matching backend ApiResponse.java)
export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp?: string;
}

// Paginated response (matching backend PageResponse.java)
export interface PaginatedResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// WebSocket event types (legacy Socket.IO - kept for backward compatibility)
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

// STOMP event types (matching Spring Boot backend)
export interface StompAgentEvent {
  eventType: 'TASK_STARTED' | 'AGENT_OUTPUT' | 'TASK_COMPLETED' | 'TASK_FAILED';
  taskId: string;
  agentType: string;
  output?: string;
  timestamp: string;
}

export interface StompWorkflowEvent {
  eventType: 'NODE_STATUS_CHANGED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED';
  workflowId: string;
  nodeId?: string;
  nodeStatus?: string;
  timestamp: string;
}

export interface StompNotificationEvent {
  type: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

// Re-export domain types
export * from './agent';
export * from './workflow';
export * from './project';
