// WebSocket hook for DeepAgent platform real-time updates

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { wsClient } from '@/lib/socket';
import { WS_EVENTS } from '@/lib/constants';
import { useAgentStore } from '@/stores/agent-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { AgentStatusEvent, AgentMessageEvent, WorkflowUpdateEvent } from '@/types';

export function useWebSocket(projectId?: string) {
  const connectedRef = useRef(false);
  const updateAgentStatus = useAgentStore((s) => s.updateAgent);
  const addMessage = useAgentStore((s) => s.addMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const updateWorkflowNode = useWorkflowStore((s) => s.updateNode);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!connectedRef.current) {
      wsClient.connect();
      connectedRef.current = true;
    }

    return () => {
      wsClient.disconnect();
      connectedRef.current = false;
    };
  }, []);

  // Join/leave project room
  useEffect(() => {
    if (projectId) {
      wsClient.joinProject(projectId);
      return () => {
        wsClient.leaveProject(projectId);
      };
    }
  }, [projectId]);

  // Subscribe to agent status events
  useEffect(() => {
    const handler = (data: unknown) => {
      const event = data as AgentStatusEvent['payload'];
      updateAgentStatus(event.agentId, { status: event.status as import('@/types').AgentStatus });
    };
    wsClient.onAgentStatus(handler);
    return () => wsClient.off(WS_EVENTS.AGENT_STATUS, handler);
  }, [updateAgentStatus]);

  // Subscribe to agent message events
  useEffect(() => {
    const handler = (data: unknown) => {
      const event = data as AgentMessageEvent['payload'];
      if (event.isStreaming) {
        updateLastMessage(event.content);
      } else {
        addMessage({
          id: event.messageId,
          role: 'assistant',
          content: event.content,
          agentId: event.agentId,
          projectId: projectId ?? '',
          timestamp: new Date().toISOString(),
        });
      }
    };
    wsClient.onAgentMessage(handler);
    return () => wsClient.off(WS_EVENTS.AGENT_MESSAGE, handler);
  }, [addMessage, updateLastMessage, projectId]);

  // Subscribe to workflow update events
  useEffect(() => {
    const handler = (data: unknown) => {
      const event = data as WorkflowUpdateEvent['payload'];
      updateWorkflowNode(event.nodeId, {
        status: event.status as 'idle' | 'running' | 'success' | 'error',
      });
    };
    wsClient.onWorkflowUpdate(handler);
    return () => wsClient.off(WS_EVENTS.WORKFLOW_UPDATE, handler);
  }, [updateWorkflowNode]);

  const isConnected = useCallback(() => wsClient.isConnected(), []);

  return { isConnected };
}
