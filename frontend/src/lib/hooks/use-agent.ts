// Agent interaction hook for DeepAgent platform

'use client';

import { useCallback } from 'react';
import { useAgentStore } from '@/stores/agent-store';
import apiClient from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
  Agent,
  ChatMessage,
  AgentConversation,
  ApiResponse,
} from '@/types';

export function useAgent(projectId: string) {
  const {
    agents,
    currentAgent,
    conversations,
    currentConversation,
    messages,
    isStreaming,
    isLoading,
    error,
    setAgents,
    setCurrentAgent,
    setConversations,
    setCurrentConversation,
    setMessages,
    addMessage,
    updateLastMessage,
    setStreaming,
    setLoading,
    setError,
    clearError,
    reset,
  } = useAgentStore();

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ApiResponse<Agent[]>>(
        API_ENDPOINTS.AGENTS.LIST(projectId)
      );
      setAgents(response.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch agents';
      setError(message);
    }
  }, [projectId, setAgents, setLoading, setError]);

  const selectAgent = useCallback(
    (agent: Agent) => {
      setCurrentAgent(agent);
      setMessages([]);
    },
    [setCurrentAgent, setMessages]
  );

  const fetchConversations = useCallback(
    async (agentId: string) => {
      try {
        setLoading(true);
        const response = await apiClient.get<ApiResponse<AgentConversation[]>>(
          `${API_ENDPOINTS.AGENTS.DETAIL(projectId, agentId)}/conversations`
        );
        setConversations(response.data.data);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to fetch conversations';
        setError(message);
      }
    },
    [projectId, setConversations, setLoading, setError]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentAgent) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        agentId: currentAgent.id,
        projectId,
        timestamp: new Date().toISOString(),
      };

      addMessage(userMessage);
      setStreaming(true);

      try {
        const response = await apiClient.post<
          ApiResponse<{ messageId: string; content: string }>
        >(API_ENDPOINTS.AGENTS.CHAT(projectId, currentAgent.id), {
          message: content,
          conversationId: currentConversation?.id,
        });

        const assistantMessage: ChatMessage = {
          id: response.data.data.messageId,
          role: 'assistant',
          content: response.data.data.content,
          agentId: currentAgent.id,
          projectId,
          timestamp: new Date().toISOString(),
        };

        addMessage(assistantMessage);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to send message';
        setError(message);
      } finally {
        setStreaming(false);
      }
    },
    [currentAgent, currentConversation, projectId, addMessage, setStreaming, setError]
  );

  return {
    agents,
    currentAgent,
    conversations,
    currentConversation,
    messages,
    isStreaming,
    isLoading,
    error,
    fetchAgents,
    selectAgent,
    fetchConversations,
    setCurrentConversation,
    sendMessage,
    updateLastMessage,
    clearError,
    reset,
  };
}
