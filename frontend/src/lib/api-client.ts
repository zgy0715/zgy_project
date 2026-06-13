// API client with axios for DeepAgent platform

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_ENDPOINTS, STORAGE_KEYS } from './constants';
import type { ApiResponse } from '@/types';

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

// Response interceptor: handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Attempt token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (refreshToken) {
          const { data } = await axios.post<ApiResponse<import('@/types').AuthResponse>>(
            `${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
            null,
            { headers: { 'X-Refresh-Token': refreshToken } }
          );
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.data.accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed, redirect to login
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
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

  logout: () =>
    apiClient.post<ApiResponse<void>>(API_ENDPOINTS.AUTH.LOGOUT),

  me: () =>
    apiClient.get<ApiResponse<{ user: import('@/types').User }>>(API_ENDPOINTS.AUTH.ME),
};

// Projects API
export const projectsApi = {
  list: () =>
    apiClient.get<ApiResponse<{ items: import('@/types').Project[]; total: number; page: number; pageSize: number; totalPages: number }>>(API_ENDPOINTS.PROJECTS.LIST),

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
    apiClient.get<ApiResponse<{ content: string }>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId)),

  updateFile: (projectId: string, fileId: string, content: string) =>
    apiClient.put<ApiResponse<void>>(API_ENDPOINTS.PROJECTS.FILE_CONTENT(projectId, fileId), { content }),

  activity: (id: string) =>
    apiClient.get<ApiResponse<import('@/types').ProjectActivity[]>>(API_ENDPOINTS.PROJECTS.ACTIVITY(id)),
};

// Agents API
export const agentsApi = {
  list: () =>
    apiClient.get<ApiResponse<import('@/types').Agent[]>>(
      API_ENDPOINTS.AGENTS.LIST
    ),

  detail: (agentId: string) =>
    apiClient.get<ApiResponse<import('@/types').Agent>>(
      API_ENDPOINTS.AGENTS.DETAIL(agentId)
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
  list: () =>
    apiClient.get<ApiResponse<import('@/types').Workflow[]>>(
      API_ENDPOINTS.WORKFLOWS.LIST
    ),

  detail: (id: string) =>
    apiClient.get<ApiResponse<import('@/types').Workflow>>(
      API_ENDPOINTS.WORKFLOWS.DETAIL(id)
    ),

  save: (id: string, data: { nodes: import('@/types').WorkflowNode[]; edges: import('@/types').WorkflowEdge[] }) =>
    apiClient.put<ApiResponse<import('@/types').Workflow>>(
      API_ENDPOINTS.WORKFLOWS.DETAIL(id),
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

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
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
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
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
    callbacks.onError?.((err as Error).message ?? 'Stream connection failed');
  }
}

export default apiClient;
