// STOMP WebSocket client for DeepAgent platform real-time communication
// Replaces Socket.IO to match Spring Boot backend's STOMP protocol

import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { STORAGE_KEYS } from './constants';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8080/ws';

// STOMP event types matching backend WebSocketConfig
export type AgentEventType = 'TASK_STARTED' | 'AGENT_OUTPUT' | 'TASK_COMPLETED' | 'TASK_FAILED';
export type WorkflowEventType = 'NODE_STATUS_CHANGED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED';

export interface AgentEvent {
  eventType: AgentEventType;
  taskId: string;
  agentType: string;
  output?: string;
  timestamp: string;
}

export interface WorkflowEvent {
  eventType: WorkflowEventType;
  workflowId: string;
  nodeId?: string;
  nodeStatus?: string;
  timestamp: string;
}

export interface NotificationEvent {
  type: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

type ConnectionCallback = () => void;
type ErrorCallback = (error: string) => void;

class StompClient {
  private client: Client | null = null;
  private subscriptions: Map<string, StompSubscription> = new Map();
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private onConnectCallbacks: ConnectionCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];

  // Connect to STOMP server via SockJS
  connect(token?: string): void {
    if (this.client?.active) return;

    const authToken = token ?? (typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ?? undefined
      : undefined);

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 1000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: (frame) => {
        console.log('[STOMP] Connected:', frame.headers);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.onConnectCallbacks.forEach((cb) => cb());
      },
      onDisconnect: (frame) => {
        console.log('[STOMP] Disconnected:', frame?.headers);
        this.connected = false;
      },
      onStompError: (frame) => {
        console.error('[STOMP] Error:', frame.headers['message'], frame.body);
        this.connected = false;
        this.onErrorCallbacks.forEach((cb) => cb(frame.headers['message'] ?? 'STOMP error'));
      },
      onWebSocketClose: (evt) => {
        console.log('[STOMP] WebSocket closed:', evt.code, evt.reason);
        this.connected = false;
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.warn('[STOMP] Max reconnect attempts reached');
          this.client?.deactivate();
        }
      },
    });

    // Set auth headers for CONNECT frame
    if (authToken) {
      this.client.connectHeaders = {
        Authorization: `Bearer ${authToken}`,
      };
    }

    this.client.activate();
  }

  // Disconnect from STOMP server
  disconnect(): void {
    // Unsubscribe all subscriptions
    this.subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.subscriptions.clear();

    if (this.client?.active) {
      this.client.deactivate();
    }
    this.client = null;
    this.connected = false;
    this.onConnectCallbacks = [];
    this.onErrorCallbacks = [];
  }

  // Register a callback for when connection is established
  onConnect(callback: ConnectionCallback): void {
    this.onConnectCallbacks.push(callback);
    // If already connected, call immediately
    if (this.connected) {
      callback();
    }
  }

  // Register a callback for connection errors
  onError(callback: ErrorCallback): void {
    this.onErrorCallbacks.push(callback);
  }

  // Join a project channel for project-specific events
  joinProject(
    projectId: string,
    callbacks: {
      onAgentEvent?: (event: AgentEvent) => void;
      onWorkflowEvent?: (event: WorkflowEvent) => void;
    }
  ): void {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot join project: not connected');
      return;
    }

    const topic = `/topic/project/${projectId}`;

    // Avoid duplicate subscriptions
    if (this.subscriptions.has(topic)) {
      return;
    }

    const subscription = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const event = JSON.parse(message.body);

        // Route based on event type
        if (isAgentEvent(event)) {
          callbacks.onAgentEvent?.(event);
        } else if (isWorkflowEvent(event)) {
          callbacks.onWorkflowEvent?.(event);
        }
      } catch (err) {
        console.error('[STOMP] Failed to parse project event:', err);
      }
    });

    this.subscriptions.set(topic, subscription);
  }

  // Leave a project channel
  leaveProject(projectId: string): void {
    const topic = `/topic/project/${projectId}`;
    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      try {
        subscription.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
      this.subscriptions.delete(topic);
    }
  }

  // Subscribe to task-specific output channel
  // Returns an unsubscribe function
  subscribeTaskOutput(
    projectId: string,
    taskId: string,
    callback: (output: string) => void
  ): () => void {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot subscribe to task: not connected');
      return () => {};
    }

    const topic = `/topic/project/${projectId}/task/${taskId}`;
    if (this.subscriptions.has(topic)) {
      return () => {};
    }

    const subscription = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const event = JSON.parse(message.body) as AgentEvent;
        callback(event.output ?? message.body);
      } catch (err) {
        console.error('[STOMP] Failed to parse task event:', err);
        callback(message.body);
      }
    });

    this.subscriptions.set(topic, subscription);

    // Return unsubscribe function
    return () => {
      try {
        subscription.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
      this.subscriptions.delete(topic);
    };
  }

  // Unsubscribe from task-specific output channel
  unsubscribeTaskOutput(projectId: string, taskId: string): void {
    const topic = `/topic/project/${projectId}/task/${taskId}`;
    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      try {
        subscription.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
      this.subscriptions.delete(topic);
    }
  }

  // Subscribe to user-specific notification channel
  subscribeNotifications(callback: (notification: NotificationEvent) => void): void {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot subscribe to notifications: not connected');
      return;
    }

    const topic = '/user/queue/notifications';
    if (this.subscriptions.has(topic)) {
      return;
    }

    const subscription = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const notification = JSON.parse(message.body) as NotificationEvent;
        callback(notification);
      } catch (err) {
        console.error('[STOMP] Failed to parse notification:', err);
      }
    });

    this.subscriptions.set(topic, subscription);
  }

  // Unsubscribe from user notifications
  unsubscribeNotifications(): void {
    const topic = '/user/queue/notifications';
    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      try {
        subscription.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
      this.subscriptions.delete(topic);
    }
  }

  // Send terminal input to backend via STOMP
  sendTerminalInput(projectId: string, command: string): void {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot send terminal input: not connected');
      return;
    }
    this.client.publish({
      destination: `/app/project/${projectId}/terminal`,
      body: JSON.stringify({ command }),
    });
  }

  // Send a message to the server via STOMP
  send(destination: string, body: unknown): void {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot send: not connected');
      return;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }

  // Check if currently connected
  isConnected(): boolean {
    return this.connected && (this.client?.active ?? false);
  }
}

// Type guards for event routing
function isAgentEvent(event: unknown): event is AgentEvent {
  if (typeof event !== 'object' || event === null) return false;
  const obj = event as Record<string, unknown>;
  return ['TASK_STARTED', 'AGENT_OUTPUT', 'TASK_COMPLETED', 'TASK_FAILED'].includes(
    obj.eventType as string
  );
}

function isWorkflowEvent(event: unknown): event is WorkflowEvent {
  if (typeof event !== 'object' || event === null) return false;
  const obj = event as Record<string, unknown>;
  return ['NODE_STATUS_CHANGED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED'].includes(
    obj.eventType as string
  );
}

// Singleton instance
export const stompClient = new StompClient();
export default stompClient;
