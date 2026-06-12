// Application constants for DeepAgent platform

export const APP_NAME = 'DeepAgent';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'Multi-AI Agent Collaborative Development Platform';

// API mode: 'mock' uses local mock data, 'api' uses real backend
export const API_MODE = (process.env.NEXT_PUBLIC_API_MODE ?? 'mock') as 'mock' | 'api';

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  PROJECTS: {
    LIST: '/projects',
    DETAIL: (id: string) => `/projects/${id}`,
    CREATE: '/projects',
    UPDATE: (id: string) => `/projects/${id}`,
    DELETE: (id: string) => `/projects/${id}`,
    FILES: (id: string) => `/projects/${id}/files`,
    FILE_CONTENT: (projectId: string, fileId: string) => `/projects/${projectId}/files/${fileId}`,
    ACTIVITY: (id: string) => `/projects/${id}/activity`,
  },
  AGENTS: {
    LIST: '/agents',
    DETAIL: (agentId: string) => `/agents/${agentId}`,
    CHAT: (agentId: string) => `/agents/${agentId}/chat`,
    CHAT_STREAM: (agentId: string) => `/agents/${agentId}/chat/stream`,
    THINKING_CHAIN: (agentId: string) => `/agents/${agentId}/thinking-chain`,
    MESSAGES: (agentId: string) => `/agents/${agentId}/messages`,
    REVIEW_FINDINGS: (agentId: string) => `/agents/${agentId}/review-findings`,
    CONFIG: (agentId: string) => `/agents/${agentId}/config`,
  },
  WORKFLOWS: {
    LIST: '/workflows',
    DETAIL: (id: string) => `/workflows/${id}`,
    EXECUTE: (id: string) => `/workflows/${id}/execute`,
    TEMPLATES: '/workflows/templates',
  },
} as const;

// WebSocket STOMP configuration (matching Spring Boot backend)
export const WS_CONFIG = {
  ENDPOINT: '/ws',
  BROKER_PREFIX: '/topic',
  APP_PREFIX: '/app',
  USER_PREFIX: '/user',
} as const;

// STOMP topic paths
export const STOMP_TOPICS = {
  PROJECT: (projectId: string) => `/topic/project/${projectId}`,
  TASK_OUTPUT: (projectId: string, taskId: string) =>
    `/topic/project/${projectId}/task/${taskId}`,
  USER_NOTIFICATIONS: '/user/queue/notifications',
} as const;

// STOMP event types (matching backend)
export const STOMP_EVENTS = {
  AGENT: {
    TASK_STARTED: 'TASK_STARTED',
    AGENT_OUTPUT: 'AGENT_OUTPUT',
    TASK_COMPLETED: 'TASK_COMPLETED',
    TASK_FAILED: 'TASK_FAILED',
  },
  WORKFLOW: {
    NODE_STATUS_CHANGED: 'NODE_STATUS_CHANGED',
    WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
    WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  },
} as const;

// Legacy WebSocket event names (kept for backward compatibility)
export const WS_EVENTS = {
  AGENT_MESSAGE: 'agent_message',
  AGENT_STATUS: 'agent_status',
  WORKFLOW_UPDATE: 'workflow_update',
  PROJECT_UPDATE: 'project_update',
  NOTIFICATION: 'notification',
  ERROR: 'error',
} as const;

// Agent type metadata
export const AGENT_TYPE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  coordinator: { label: 'Coordinator', color: '#8b5cf6', icon: 'Brain' },
  coder: { label: 'Coder', color: '#3b82f6', icon: 'Code' },
  reviewer: { label: 'Reviewer', color: '#f59e0b', icon: 'Search' },
  tester: { label: 'Tester', color: '#22c55e', icon: 'TestTube' },
  deployer: { label: 'Deployer', color: '#ef4444', icon: 'Rocket' },
};

// Agent status metadata
export const AGENT_STATUS_META: Record<
  string,
  { label: string; color: string; className: string }
> = {
  pending: { label: 'Pending', color: '#94a3b8', className: 'bg-slate-400' },
  planning: { label: 'Planning', color: '#f59e0b', className: 'bg-amber-500 animate-thinking' },
  executing: { label: 'Executing', color: '#3b82f6', className: 'bg-blue-500' },
  reviewing: { label: 'Reviewing', color: '#8b5cf6', className: 'bg-violet-500' },
  completed: { label: 'Completed', color: '#22c55e', className: 'bg-green-500' },
  failed: { label: 'Failed', color: '#ef4444', className: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: '#64748b', className: 'bg-zinc-500' },
};

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'deepagent_auth_token',
  REFRESH_TOKEN: 'deepagent_refresh_token',
  THEME: 'deepagent_theme',
  SIDEBAR_COLLAPSED: 'deepagent_sidebar_collapsed',
} as const;
