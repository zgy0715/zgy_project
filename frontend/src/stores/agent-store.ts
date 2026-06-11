// Agent state management with Zustand

import { create } from 'zustand';
import type { Agent, ChatMessage, ThinkingChain, AgentConversation } from '@/types';

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
  setConversations: (conversations: AgentConversation[]) => void;
  setCurrentConversation: (conversation: AgentConversation | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  addThinkingChain: (chain: ThinkingChain) => void;
  setStreaming: (isStreaming: boolean) => void;
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

export const useAgentStore = create<AgentState>()((set) => ({
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

  setStreaming: (isStreaming) => set({ isStreaming }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));
