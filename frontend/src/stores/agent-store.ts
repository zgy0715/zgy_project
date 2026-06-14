// Agent state management with Zustand

import { create } from 'zustand';
import type { Agent, ChatMessage, ThinkingChain, AgentConversation } from '@/types';
import { agentsApi, streamAgentChat } from '@/lib/api-client';
import { generateId } from '@/lib/utils';

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  conversations: AgentConversation[];
  currentConversation: AgentConversation | null;
  messages: ChatMessage[];
  thinkingChains: ThinkingChain[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  selectAgent: (id: string) => void;
  fetchAgents: (projectId: string) => Promise<void>;
  createAgent: (data: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
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

    set({ currentAgent: agent, messages: [], currentConversation: null });
    get().fetchMessages(id);
  },

  fetchAgents: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.list(projectId ? { projectId } : undefined);
      const agents = response.data.data;
      set({
        agents,
        currentAgent: agents[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取智能体列表失败';
      set({ error: message, isLoading: false });
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
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '创建智能体失败';
      set({ error: message, isLoading: false });
    }
  },

  deleteAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await agentsApi.delete(id);
      get().removeAgent(id);
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '删除智能体失败';
      set({ error: message, isLoading: false });
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
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        messages[messages.length - 1] = { ...last, content };
      }
      return { messages };
    }),

  addThinkingChain: (chain) =>
    set((state) => ({ thinkingChains: [...state.thinkingChains, chain] })),

  fetchThinkingChain: async (agentId) => {
    try {
      const response = await agentsApi.thinkingChain(agentId);
      set({ thinkingChains: response.data.data });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取思维链失败';
      set({ error: message });
    }
  },

  fetchMessages: async (agentId, conversationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.messages(agentId, {
        conversationId,
      });
      set({ messages: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取消息记录失败';
      set({ error: message, isLoading: false });
    }
  },

  setStreaming: (isStreaming) => set({ isStreaming }),

  sendMessage: (content) => {
    const { currentAgent, currentConversation } = get();
    if (!currentAgent) return;

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
          set({ isStreaming: false });
        },
        onError: (errorMsg) => {
          get().updateLastMessage(`错误: ${errorMsg}`);
          get().updateAgent(currentAgent.id, { status: 'failed' });
          set({ isStreaming: false, error: errorMsg });
        },
      }
    ).catch((err) => {
      const message = (err as Error).message ?? '发送消息失败';
      get().updateLastMessage(`错误: ${message}`);
      get().updateAgent(currentAgent.id, { status: 'failed' });
      set({ isStreaming: false, error: message });
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));
