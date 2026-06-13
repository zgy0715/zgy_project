// Agent interaction hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useAgentStore } from '@/stores/agent-store';
import type { Agent, ChatMessage, AgentConversation } from '@/types';

export function useAgent(projectId: string) {
  const {
    agents,
    currentAgent,
    conversations,
    currentConversation,
    messages,
    thinkingChains,
    isStreaming,
    isLoading,
    error,
    fetchAgents,
    selectAgent,
    setConversations,
    setCurrentConversation,
    setMessages,
    addMessage,
    updateLastMessage,
    sendMessage,
    setStreaming,
    setLoading,
    setError,
    clearError,
    reset,
  } = useAgentStore();

  const fetchAgentsList = useCallback(async () => {
    await fetchAgents(projectId);
  }, [fetchAgents, projectId]);

  const selectAgentById = useCallback(
    (agent: Agent) => {
      selectAgent(agent.id);
    },
    [selectAgent]
  );

  const fetchConversationsList = useCallback(
    async (_agentId: string) => {
      // Conversations are managed by the store in both mock and API modes
      setConversations(useAgentStore.getState().conversations);
    },
    [setConversations]
  );

  const sendChatMessage = useCallback(
    async (content: string) => {
      sendMessage(content);
    },
    [sendMessage]
  );

  return {
    agents,
    currentAgent,
    conversations,
    currentConversation,
    messages,
    thinkingChains,
    isStreaming,
    isLoading,
    error,
    fetchAgents: fetchAgentsList,
    selectAgent: selectAgentById,
    fetchConversations: fetchConversationsList,
    setCurrentConversation,
    sendMessage: sendChatMessage,
    updateLastMessage,
    clearError,
    reset,
  };
}
