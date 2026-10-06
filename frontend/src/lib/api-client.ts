// API client with axios for DeepAgent platform

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_ENDPOINTS, STORAGE_KEYS } from './constants';
import type { ApiResponse, PaginatedResponse } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh mutex - prevent concurrent refresh requests
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// Response interceptor: handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Auth endpoints legitimately return 401 (bad credentials, expired refresh
    // token). Never try to refresh on those - a failed /auth/login must surface
    // its own error instead of kicking off a refresh round-trip.
    const isAuthEndpoint = [
      API_ENDPOINTS.AUTH.LOGIN,
      API_ENDPOINTS.AUTH.REGISTER,
      API_ENDPOINTS.AUTH.REFRESH,
    ].some((path) => originalRequest?.url?.includes(path));

    // Attempt token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to retry after refresh completes
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<import('@/types').AuthResponse>>(
          `${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
          null,
          { headers: { 'X-Refresh-Token': refreshToken } }
        );

        const newToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        if (!newToken) {
          throw new Error('刷新令牌响应缺少 accessToken');
        }

        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newToken);
        if (newRefreshToken) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        }

        onTokenRefreshed(newToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// --- Resource API methods ---

// Auth API
export const authApi = {
  login: (data: { username: string; password: string }) =>
    apiClient.post<ApiResponse<import('@/types').AuthResponse>>(
      API_ENDPOINTS.AUTH.LOGIN,
      data
    ),

  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post<ApiResponse<import('@/types').AuthResponse>>(
      API_ENDPOINTS.AUTH.REGISTER,
      data
    ),

  logout: () => {
    const refreshToken = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
      : null;
    return apiClient.post<ApiResponse<void>>(
      API_ENDPOINTS.AUTH.LOGOUT,
      null,
      { headers: refreshToken ? { 'X-Refresh-Token': refreshToken } : {} }
    );
  },

  me: () =>
    apiClient.get<ApiResponse<import('@/types').AuthResponse>>(API_ENDPOINTS.AUTH.ME),

  updateProfile: (data: { username?: string; email?: string; avatarUrl?: string }) =>
    apiClient.put<ApiResponse<import('@/types').User>>(
      API_ENDPOINTS.AUTH.PROFILE,
      data
    ),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    apiClient.post<ApiResponse<void>>(
      API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
      data
    ),
};

// Projects API
export const projectsApi = {
  list: (params?: { page?: number; size?: number }) =>
    apiClient.get<ApiResponse<PaginatedResponse<import('@/types').Project>>>(
      API_ENDPOINTS.PROJECTS.LIST,
      { params }
    ),

  detail: (id: string) =>
    apiClient.get<ApiResponse<import('@/types').Project>>(API_ENDPOINTS.PROJECTS.DETAIL(id)),

  create: (data: import('@/types').CreateProjectRequest) =>
    apiClient.post<ApiResponse<import('@/types').Project>>(API_ENDPOINTS.PROJECTS.CREATE, data),

  update: (id: string, data: import('@/types').UpdateProjectRequest) =>
    apiClient.put<ApiResponse<import('@/types').Project>>(API_ENDPOINTS.PROJECTS.UPDATE(id), data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.PROJECTS.DELETE(id)),

  files: (id: string) =>
    apiClient.get<ApiResponse<import('@/types').ProjectFile[]>>(API_ENDPOINTS.PROJECTS.FILES(id)),

  fileContent: (projectId: string, fileId: string) =>
    apiClient.get<ApiResponse<import('@/types').ProjectFile>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId)),

  createFile: (
    projectId: string,
    data: { name: string; path: string; type: 'file' | 'directory'; content?: string }
  ) =>
    apiClient.post<ApiResponse<import('@/types').ProjectFile>>(
      API_ENDPOINTS.PROJECTS.FILES(projectId),
      data
    ),

  updateFile: (projectId: string, fileId: string, content: string) =>
    apiClient.put<ApiResponse<import('@/types').ProjectFile>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId), { content }),

  renameFile: (projectId: string, fileId: string, data: { name: string; path: string }) =>
    apiClient.put<ApiResponse<import('@/types').ProjectFile>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId), data),

  deleteFile: (projectId: string, fileId: string) =>
    apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId)),

  activity: (id: string, params?: { limit?: number }) =>
    apiClient.get<ApiResponse<import('@/types').ProjectActivity[]>>(
      API_ENDPOINTS.PROJECTS.ACTIVITY(id),
      { params }
    ),
};

// Agents API
export const agentsApi = {
  // The gateway `GET /agents` only understands `agentType` / `statusFilter`;
  // project scoping is applied client-side.
  list: (params?: { agentType?: string; statusFilter?: string }) =>
    apiClient.get<ApiResponse<import('@/types').Agent[]>>(
      API_ENDPOINTS.AGENTS.LIST,
      { params }
    ),

  detail: (agentId: string) =>
    apiClient.get<ApiResponse<import('@/types').Agent>>(
      API_ENDPOINTS.AGENTS.DETAIL(agentId)
    ),

  create: (data: Partial<import('@/types').Agent>) =>
    apiClient.post<ApiResponse<import('@/types').Agent>>(
      API_ENDPOINTS.AGENTS.LIST,
      data
    ),

  update: (
    agentId: string,
    data: {
      name?: string;
      description?: string;
      agentType?: import('@/types').AgentType;
      config?: unknown;
    }
  ) =>
    apiClient.put<ApiResponse<import('@/types').Agent>>(
      API_ENDPOINTS.AGENTS.DETAIL(agentId),
      data
    ),

  delete: (agentId: string) =>
    apiClient.delete<ApiResponse<void>>(
      API_ENDPOINTS.AGENTS.DETAIL(agentId)
    ),

  execute: (agentId: string, data: { task: string; projectId?: string; stream?: boolean }) =>
    apiClient.post<ApiResponse<{ taskId: string; status?: string; message?: string }>>(
      API_ENDPOINTS.AGENTS.EXECUTE(agentId),
      data
    ),

  chat: (agentId: string, data: { message: string; conversationId?: string }) =>
    apiClient.post<ApiResponse<{ messageId: string; content: string }>>(
      API_ENDPOINTS.AGENTS.CHAT(agentId),
      data
    ),

  config: (agentId: string) =>
    apiClient.get<ApiResponse<import('@/types').AgentConfig>>(
      API_ENDPOINTS.AGENTS.CONFIG(agentId)
    ),

  updateConfig: (agentId: string, data: Partial<import('@/types').AgentConfig>) =>
    apiClient.put<ApiResponse<import('@/types').AgentConfig>>(
      API_ENDPOINTS.AGENTS.CONFIG(agentId),
      data
    ),

  thinkingChain: (agentId: string) =>
    apiClient.get<ApiResponse<import('@/types').ThinkingChain[]>>(
      API_ENDPOINTS.AGENTS.THINKING_CHAIN(agentId)
    ),

  messages: (agentId: string, params?: { conversationId?: string; limit?: number; offset?: number }) =>
    apiClient.get<ApiResponse<import('@/types').ChatMessage[]>>(
      API_ENDPOINTS.AGENTS.MESSAGES(agentId),
      { params }
    ),

  reviewFindings: (agentId: string) =>
    apiClient.get<ApiResponse<unknown[]>>(
      API_ENDPOINTS.AGENTS.REVIEW_FINDINGS(agentId)
    ),
};

// Workflows API
export const workflowsApi = {
  // The gateway `GET /workflows` only understands `statusFilter`; project
  // scoping is applied client-side.
  list: (params?: { statusFilter?: string }) =>
    apiClient.get<ApiResponse<import('@/types').Workflow[]>>(
      API_ENDPOINTS.WORKFLOWS.LIST,
      { params }
    ),

  detail: (id: string) =>
    apiClient.get<ApiResponse<import('@/types').Workflow>>(
      API_ENDPOINTS.WORKFLOWS.DETAIL(id)
    ),

  create: (data: Partial<import('@/types').Workflow>) =>
    apiClient.post<ApiResponse<import('@/types').Workflow>>(
      API_ENDPOINTS.WORKFLOWS.LIST,
      data
    ),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<void>>(
      API_ENDPOINTS.WORKFLOWS.DETAIL(id)
    ),

  save: (id: string, data: { name?: string; description?: string; nodes?: import('@/types').WorkflowNode[]; edges?: import('@/types').WorkflowEdge[]; definition?: unknown; status?: string }) =>
    apiClient.put<ApiResponse<import('@/types').Workflow>>(
      API_ENDPOINTS.WORKFLOWS.UPDATE(id),
      data
    ),

  execute: (id: string) =>
    apiClient.post<ApiResponse<import('@/types').WorkflowExecution>>(
      API_ENDPOINTS.WORKFLOWS.EXECUTE(id)
    ),

  templates: () =>
    apiClient.get<ApiResponse<import('@/types').WorkflowTemplate[]>>(
      API_ENDPOINTS.WORKFLOWS.TEMPLATES
    ),
};

// Tasks API (gateway SchedulerController, `/api/v1/tasks`)
export const tasksApi = {
  detail: (taskId: string) =>
    apiClient.get<ApiResponse<unknown>>(API_ENDPOINTS.TASKS.DETAIL(taskId)),

  update: (taskId: string, data: { status?: string }) =>
    apiClient.put<ApiResponse<unknown>>(API_ENDPOINTS.TASKS.DETAIL(taskId), data),

  delete: (taskId: string) =>
    apiClient.delete<ApiResponse<void>>(API_ENDPOINTS.TASKS.DETAIL(taskId)),
};

// --- SSE streaming support ---

export interface SSEMessageEvent {
  type: 'message_start' | 'content_delta' | 'message_end' | 'thinking' | 'chunk' | 'complete' | 'error';
  data: unknown;
}

export interface SSECallbacks {
  onStart?: (messageId: string) => void;
  onDelta?: (content: string) => void;
  onEnd?: (fullContent: string) => void;
  onError?: (error: string) => void;
}

/**
 * Send a chat message and receive streaming response via SSE (Server-Sent Events).
 * Uses fetch() with ReadableStream for streaming.
 */
export async function streamAgentChat(
  agentId: string,
  data: { message: string; conversationId?: string },
  callbacks: SSECallbacks
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null;
  const url = `${BASE_URL}${API_ENDPOINTS.AGENTS.CHAT_STREAM(agentId)}`;

  const controller = new AbortController();
  const overallTimeout = setTimeout(() => controller.abort(), 300000); // 5-minute total timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError?.(errorText || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.('No readable stream');
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const readTimeout = setTimeout(() => controller.abort(), 60000); // 60-second read timeout
      const { done, value } = await reader.read();
      clearTimeout(readTimeout);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer. The wire format may use \n or \r\n,
      // so split on either and strip any trailing carriage return.
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') {
            callbacks.onEnd?.(fullContent);
            return;
          }

          try {
            const event = JSON.parse(jsonStr) as SSEMessageEvent;

            switch (event.type) {
              case 'message_start':
                callbacks.onStart?.((event.data as { messageId: string }).messageId);
                break;
              case 'content_delta':
                const delta = (event.data as { content: string }).content;
                fullContent += delta;
                callbacks.onDelta?.(fullContent);
                break;
              case 'message_end':
                callbacks.onEnd?.(fullContent);
                return;
              case 'error':
                callbacks.onError?.((event.data as { message: string }).message ?? 'Stream error');
                return;
            }
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    }

    // Stream ended without [DONE]
    callbacks.onEnd?.(fullContent);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onError?.('Stream timed out');
    } else {
      callbacks.onError?.((err as Error).message ?? 'Stream connection failed');
    }
  } finally {
    clearTimeout(overallTimeout);
  }
}

export default apiClient;
