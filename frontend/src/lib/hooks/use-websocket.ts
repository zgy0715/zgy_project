// WebSocket hook for DeepAgent platform real-time updates
// Uses STOMP over WebSocket to match Spring Boot backend

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { stompClient } from '@/lib/socket';
import type { AgentEvent, WorkflowEvent } from '@/lib/socket';
import { useAgentStore } from '@/stores/agent-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { AgentStatus } from '@/types';

// Map STOMP agent event types to AgentStatus
function agentEventTypeToStatus(eventType: AgentEvent['eventType']): AgentStatus {
  switch (eventType) {
    case 'TASK_STARTED':
      return 'executing';
    case 'AGENT_OUTPUT':
      return 'executing';
    case 'TASK_COMPLETED':
      return 'completed';
    case 'TASK_FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

// Map STOMP workflow node status to WorkflowNodeData status
function nodeStatusToWorkflowStatus(
  status: string
): 'pending' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed' {
  const mapping: Record<string, 'pending' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed'> = {
    pending: 'pending',
    planning: 'planning',
    executing: 'executing',
    reviewing: 'reviewing',
    completed: 'completed',
    failed: 'failed',
  };
  return mapping[status] ?? 'pending';
}

export function useWebSocket(projectId?: string) {
  const connectedRef = useRef(false);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const addMessage = useAgentStore((s) => s.addMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const updateWorkflowNode = useWorkflowStore((s) => s.updateNode);
  const setWorkflowExecuting = useWorkflowStore((s) => s.setExecuting);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!connectedRef.current) {
      stompClient.connect();
      connectedRef.current = true;
    }

    return () => {
      stompClient.disconnect();
      connectedRef.current = false;
    };
  }, []);

  // Join/leave project channel and handle events
  useEffect(() => {
    if (!projectId) return;

    stompClient.joinProject(projectId, {
      onAgentEvent: (event: AgentEvent) => {
        const status = agentEventTypeToStatus(event.eventType);

        switch (event.eventType) {
          case 'TASK_STARTED':
            updateAgent(event.agentType, { status });
            break;

          case 'AGENT_OUTPUT':
            // Streaming output - update the last assistant message
            updateAgent(event.agentType, { status });
            if (event.output) {
              updateLastMessage(event.output);
            }
            break;

          case 'TASK_COMPLETED':
            updateAgent(event.agentType, { status });
            // Add final message if output is present
            if (event.output) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: event.output,
                agentId: event.agentType,
                timestamp: event.timestamp,
              });
            }
            break;

          case 'TASK_FAILED':
            updateAgent(event.agentType, { status });
            break;
        }
      },

      onWorkflowEvent: (event: WorkflowEvent) => {
        switch (event.eventType) {
          case 'NODE_STATUS_CHANGED':
            if (event.nodeId && event.nodeStatus) {
              updateWorkflowNode(event.nodeId, {
                status: nodeStatusToWorkflowStatus(event.nodeStatus),
              });
            }
            break;

          case 'WORKFLOW_COMPLETED':
            setWorkflowExecuting(false);
            break;

          case 'WORKFLOW_FAILED':
            setWorkflowExecuting(false);
            break;
        }
      },
    });

    return () => {
      stompClient.leaveProject(projectId);
    };
  }, [projectId, updateAgent, addMessage, updateLastMessage, updateWorkflowNode, setWorkflowExecuting]);

  const isConnected = useCallback(() => stompClient.isConnected(), []);

  return { isConnected };
}
