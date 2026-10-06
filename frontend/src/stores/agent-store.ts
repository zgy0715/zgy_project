// Agent state management with Zustand

import { create } from 'zustand';
import type { Agent, AgentType, ChatMessage, ThinkingChain, AgentConversation } from '@/types';
import { agentsApi, tasksApi, streamAgentChat } from '@/lib/api-client';
import { generateId, asArray, getErrorMessage } from '@/lib/utils';

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  conversations: AgentConversation[];
  currentConversation: AgentConversation | null;
  messages: ChatMessage[];
  thinkingChains: ThinkingChain[];
  isStreaming: boolean;
  /** Id of the assistant placeholder currently being streamed into. */
  streamingMessageId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  selectAgent: (id: string) => void;
  fetchAgents: (projectId?: string) => Promise<void>;
  createAgent: (data: Partial<Agent>) => Promise<boolean>;
  saveAgent: (id: string, data: { name?: string; description?: string; agentType?: AgentType; config?: unknown }) => Promise<boolean>;
  startAgent: (id: string, projectId: string, task: string) => Promise<string | null>;
  cancelTask: (taskId: string) => Promise<boolean>;
  deleteAgent: (id: string) => Promise<boolean>;
  setConversations: (conversations: AgentConversation[]) => void;
  setCurrentConversation: (conversation: AgentConversation | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  addThinkingChain: (chain: ThinkingChain) => void;
  fetchThinkingChain: (agentId: string) => Promise<void>;
  fetchMessages: (agentId: string, conversationId?: string) => Promise<void>;
  setStreaming: (isStreaming: boolean) => void;
  sendMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  agents: [],
  currentAgent: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  thinkingChains: [],
  isStreaming: false,
  streamingMessageId: null,
  isLoading: false,
  error: null,
};

export const useAgentStore = create<AgentState>()((set, get) => ({
  ...initialState,

  setAgents: (agents) => set({ agents, isLoading: false }),

  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
      currentAgent:
        state.currentAgent?.id === id
          ? { ...state.currentAgent, ...updates }
          : state.currentAgent,
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      currentAgent:
        state.currentAgent?.id === id ? null : state.currentAgent,
    })),

  setCurrentAgent: (currentAgent) => set({ currentAgent }),

  selectAgent: (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;

    set({
      currentAgent: agent,
      messages: [],
      currentConversation: null,
      streamingMessageId: null,
    });
    get().fetchMessages(id);
  },

  fetchAgents: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      // The gateway list endpoint has no project filter; scope client-side.
      const response = await agentsApi.list();
      const allAgents = asArray<Agent>(response.data.data);
      const agents = projectId
        ? allAgents.filter(
            (a) => !a.projectId || String(a.projectId) === String(projectId)
          )
        : allAgents;
      set({
        agents,
        currentAgent: agents[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取智能体列表失败'),
        isLoading: false,
      });
    }
  },

  createAgent: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.create(data);
      const newAgent = response.data.data;
      set((state) => ({
        agents: [...state.agents, newAgent],
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '创建智能体失败'),
        isLoading: false,
      });
      return false;
    }
  },

  saveAgent: async (id, data) => {
    set({ error: null });
    try {
      const response = await agentsApi.update(id, data);
      const updated = response.data.data;
      get().updateAgent(id, {
        ...(updated ?? {}),
        // Fall back to the submitted fields if the gateway echoes nothing back.
        // `config` is deliberately excluded: it is not part of the Agent shape.
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.agentType !== undefined ? { agentType: data.agentType } : {}),
      });
      return true;
    } catch (error) {
      set({ error: getErrorMessage(error, '更新智能体失败') });
      return false;
    }
  },

  startAgent: async (id, projectId, task) => {
    set({ error: null });
    try {
      const response = await agentsApi.execute(id, {
        task,
        projectId,
        stream: true,
      });
      const data = response.data.data as { taskId?: string | number } | null;
      return data?.taskId !== undefined && data?.taskId !== null
        ? String(data.taskId)
        : null;
    } catch (error) {
      set({ error: getErrorMessage(error, '启动智能体失败') });
      return null;
    }
  },

  cancelTask: async (taskId) => {
    set({ error: null });
    try {
      await tasksApi.update(taskId, { status: 'CANCELLED' });
      return true;
    } catch (error) {
      set({ error: getErrorMessage(error, '停止任务失败') });
      return false;
    }
  },

  deleteAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await agentsApi.delete(id);
      get().removeAgent(id);
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '删除智能体失败'),
        isLoading: false,
      });
      return false;
    }
  },

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversation: (currentConversation) => set({ currentConversation }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length === 0) return { messages };
      // Target the placeholder created by sendMessage so that a second send
      // does not overwrite an unrelated bubble.
      const targetId = state.streamingMessageId;
      const index = targetId
        ? messages.findIndex((m) => m.id === targetId)
        : messages.length - 1;
      const safeIndex = index >= 0 ? index : messages.length - 1;
      messages[safeIndex] = { ...messages[safeIndex], content };
      return { messages };
    }),

  addThinkingChain: (chain) =>
    set((state) => ({ thinkingChains: [...state.thinkingChains, chain] })),

  fetchThinkingChain: async (agentId) => {
    try {
      const response = await agentsApi.thinkingChain(agentId);
      set({ thinkingChains: asArray<ThinkingChain>(response.data.data) });
    } catch (error) {
      set({ error: getErrorMessage(error, '获取思维链失败') });
    }
  },

  fetchMessages: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      // The gateway only accepts `limit` / `offset`; a conversationId would be
      // silently ignored, so it is not sent.
      const response = await agentsApi.messages(agentId);
      set({
        messages: asArray<ChatMessage>(response.data.data),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取消息记录失败'),
        isLoading: false,
      });
    }
  },

  setStreaming: (isStreaming) => set({ isStreaming }),

  sendMessage: (content) => {
    const { currentAgent, currentConversation, isStreaming } = get();
    if (!currentAgent) return;
    // Ignore a second send while a response is still streaming - the stream
    // callbacks write into a single placeholder.
    if (isStreaming) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      agentId: currentAgent.id,
      timestamp: new Date().toISOString(),
    };

    // Create placeholder for assistant response
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      agentId: currentAgent.id,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      streamingMessageId: assistantMessageId,
    }));

    // Set agent to planning status
    get().updateAgent(currentAgent.id, { status: 'planning' });

    // Use SSE streaming for real-time response
    streamAgentChat(
      currentAgent.id,
      {
        message: content,
        conversationId: currentConversation?.id,
      },
      {
        onStart: () => {
          get().updateAgent(currentAgent.id, { status: 'executing' });
        },
        onDelta: (fullContent) => {
          get().updateLastMessage(fullContent);
        },
        onEnd: (fullContent) => {
          get().updateLastMessage(fullContent);
          get().updateAgent(currentAgent.id, { status: 'completed' });
          set({ isStreaming: false, streamingMessageId: null });
        },
        onError: (errorMsg) => {
          get().updateLastMessage(`错误: ${errorMsg}`);
          get().updateAgent(currentAgent.id, { status: 'failed' });
          set({
            isStreaming: false,
            streamingMessageId: null,
            error: errorMsg,
          });
        },
      }
    ).catch((err: unknown) => {
      get().updateLastMessage(`错误: ${getErrorMessage(err, '发送消息失败')}`);
      get().updateAgent(currentAgent.id, { status: 'failed' });
      set({
        isStreaming: false,
        streamingMessageId: null,
        error: getErrorMessage(err, '发送消息失败'),
      });
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));
