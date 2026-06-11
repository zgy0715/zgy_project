// Application constants for DeepAgent platform

export const APP_NAME = 'DeepAgent';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'Multi-AI Agent Collaborative Development Platform';

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
    ACTIVITY: (id: string) => `/projects/${id}/activity`,
  },
  AGENTS: {
    LIST: (projectId: string) => `/projects/${projectId}/agents`,
    DETAIL: (projectId: string, agentId: string) =>
      `/projects/${projectId}/agents/${agentId}`,
    CHAT: (projectId: string, agentId: string) =>
      `/projects/${projectId}/agents/${agentId}/chat`,
    CONFIG: (projectId: string, agentId: string) =>
      `/projects/${projectId}/agents/${agentId}/config`,
  },
  WORKFLOWS: {
    LIST: (projectId: string) => `/projects/${projectId}/workflows`,
    DETAIL: (projectId: string, id: string) =>
      `/projects/${projectId}/workflows/${id}`,
    EXECUTE: (projectId: string, id: string) =>
      `/projects/${projectId}/workflows/${id}/execute`,
    TEMPLATES: '/workflows/templates',
  },
} as const;

// WebSocket event names
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
  planner: { label: 'Planner', color: '#8b5cf6', icon: 'Brain' },
  coder: { label: 'Coder', color: '#3b82f6', icon: 'Code' },
  reviewer: { label: 'Reviewer', color: '#f59e0b', icon: 'Search' },
  tester: { label: 'Tester', color: '#22c55e', icon: 'TestTube' },
  deployer: { label: 'Deployer', color: '#ef4444', icon: 'Rocket' },
  custom: { label: 'Custom', color: '#6366f1', icon: 'Settings' },
};

// Agent status metadata
export const AGENT_STATUS_META: Record<
  string,
  { label: string; color: string; className: string }
> = {
  idle: { label: 'Idle', color: '#94a3b8', className: 'bg-slate-400' },
  thinking: { label: 'Thinking', color: '#f59e0b', className: 'bg-amber-500 animate-thinking' },
  running: { label: 'Running', color: '#3b82f6', className: 'bg-blue-500' },
  success: { label: 'Success', color: '#22c55e', className: 'bg-green-500' },
  error: { label: 'Error', color: '#ef4444', className: 'bg-red-500' },
  waiting: { label: 'Waiting', color: '#8b5cf6', className: 'bg-violet-500' },
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
