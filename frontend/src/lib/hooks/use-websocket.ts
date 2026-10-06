// WebSocket hook for DeepAgent platform real-time updates
// Uses STOMP over WebSocket to match Spring Boot backend

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { stompClient, agentEventText } from '@/lib/socket';
import type { AgentEvent, WorkflowEvent, NotificationEvent } from '@/lib/socket';
import { useAgentStore } from '@/stores/agent-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useNotificationStore } from '@/stores/notification-store';
import type { AgentStatus } from '@/types';

// Map STOMP agent event types to AgentStatus
function agentEventTypeToStatus(eventType: AgentEvent['eventType']): AgentStatus {
  switch (eventType) {
    case 'TASK_STARTED':
      return 'executing';
    case 'AGENT_OUTPUT':
      return 'executing';
    case 'AGENT_THINKING':
      return 'planning';
    case 'REVIEW_FINDING':
      return 'reviewing';
    case 'TEST_RESULT':
      return 'reviewing';
    case 'TASK_COMPLETED':
      return 'completed';
    case 'TASK_FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

// Emoji shown on a user notification, keyed by the backend event type.
const NOTIFICATION_ICONS: Record<string, string> = {
  TASK_COMPLETED: '✅',
  TASK_FAILED: '❌',
  WORKFLOW_COMPLETED: '🎉',
  WORKFLOW_FAILED: '⚠️',
  REVIEW_FINDING: '🔍',
  INFO: 'ℹ️',
};

// Readable Chinese title for the same six backend notification types, so the UI
// never shows the raw enum name.
const NOTIFICATION_TITLES: Record<string, string> = {
  TASK_COMPLETED: '任务完成',
  TASK_FAILED: '任务失败',
  WORKFLOW_COMPLETED: '工作流完成',
  WORKFLOW_FAILED: '工作流失败',
  REVIEW_FINDING: '评审发现',
  INFO: '提示',
};

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
  const addNotification = useNotificationStore((s) => s.addNotification);

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

  // Subscribe to the user notification queue (/user/queue/notifications)
  useEffect(() => {
    stompClient.subscribeNotifications((notification: NotificationEvent) => {
      addNotification({
        icon: NOTIFICATION_ICONS[notification.type] ?? '🔔',
        title: NOTIFICATION_TITLES[notification.type] ?? '通知',
        description: notification.message ?? '',
        timestamp: notification.timestamp ?? new Date().toISOString(),
      });
    });

    return () => {
      stompClient.unsubscribeNotifications();
    };
  }, [addNotification]);

  // Join/leave project channel and handle events
  useEffect(() => {
    if (!projectId) return;

    stompClient.joinProject(projectId, {
      onAgentEvent: (event: AgentEvent) => {
        const status = agentEventTypeToStatus(event.eventType);
        const { agents } = useAgentStore.getState();
        const agent = agents.find(a => a.agentType === event.agentType);
        if (!agent) return;
        const agentId = agent.id;
        const text = agentEventText(event);

        switch (event.eventType) {
          case 'TASK_STARTED':
            updateAgent(agentId, { status });
            break;

          case 'AGENT_THINKING':
            updateAgent(agentId, { status });
            break;

          case 'REVIEW_FINDING':
            updateAgent(agentId, { status });
            if (text) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: text,
                agentId: agentId,
                timestamp: event.timestamp ?? new Date().toISOString(),
              });
            }
            break;

          case 'TEST_RESULT':
            updateAgent(agentId, { status });
            if (text) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: text,
                agentId: agentId,
                timestamp: event.timestamp ?? new Date().toISOString(),
              });
            }
            break;

          case 'AGENT_OUTPUT':
            updateAgent(agentId, { status });
            if (text) {
              updateLastMessage(text);
            }
            break;

          case 'TASK_COMPLETED':
            updateAgent(agentId, { status });
            if (text) {
              addMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: text,
                agentId: agentId,
                timestamp: event.timestamp ?? new Date().toISOString(),
              });
            }
            break;

          case 'TASK_FAILED':
            updateAgent(agentId, { status });
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
