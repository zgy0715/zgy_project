// STOMP WebSocket client for DeepAgent platform real-time communication
// Replaces Socket.IO to match Spring Boot backend's STOMP protocol

import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { STORAGE_KEYS } from './constants';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8080/ws';

// STOMP event types matching backend WebSocketConfig
export type AgentEventType =
  | 'TASK_STARTED'
  | 'AGENT_OUTPUT'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'AGENT_THINKING'
  | 'REVIEW_FINDING'
  | 'TEST_RESULT';
export type WorkflowEventType = 'NODE_STATUS_CHANGED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED';

/**
 * Envelope published by the gateway `AgentEventPublisher` / `AgentWebSocketHandler`.
 *
 * The text payload field on the wire is `data`; `output` is kept as an optional
 * legacy fallback for older gateway builds. Use {@link agentEventText} to read it.
 */
export interface AgentEvent {
  eventType: AgentEventType;
  projectId?: number | null;
  taskId?: number | null;
  agentType?: string | null;
  /** Canonical text payload field. */
  data?: string;
  /** @deprecated legacy gateway builds used `output` instead of `data`. */
  output?: string;
  timestamp?: string;
}

/** Reads the text payload from an agent event, tolerating the legacy `output` field. */
export function agentEventText(event: AgentEvent): string {
  return event.data ?? event.output ?? '';
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
  private baseReconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyDisconnected: boolean = false;
  private onlineListener: (() => void) | null = null;
  private onConnectCallbacks: ConnectionCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];
  private currentProjectId: string | null = null;
  private currentProjectCallbacks: {
    onAgentEvent?: (event: AgentEvent) => void;
    onWorkflowEvent?: (event: WorkflowEvent) => void;
  } | null = null;
  private notificationCallback: ((notification: NotificationEvent) => void) | null = null;

  // Connect to STOMP server via SockJS
  connect(token?: string): void {
    if (this.client?.active) return;

    this.manuallyDisconnected = false;

    const authToken = token ?? (typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ?? undefined
      : undefined);

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: this.baseReconnectDelay,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: (frame) => {
        console.log('[STOMP] Connected:', frame.headers);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.client!.reconnectDelay = this.baseReconnectDelay;
        // Re-subscribe to project channel if one was previously joined
        if (this.currentProjectId && this.currentProjectCallbacks) {
          this.joinProject(this.currentProjectId, this.currentProjectCallbacks);
        }
        // Re-subscribe to notifications
        if (this.notificationCallback) {
          this.subscribeNotifications(this.notificationCallback);
        }
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
          // Stop stompjs' own fast retry loop and switch to exponential backoff
          // so we never give up permanently.
          console.warn('[STOMP] Max reconnect attempts reached, backing off');
          this.client?.deactivate();
          this.scheduleReconnect();
        }
      },
    });

    // Set auth headers for CONNECT frame
    if (authToken) {
      this.client.connectHeaders = {
        Authorization: `Bearer ${authToken}`,
      };
    }

    this.attachOnlineListener();
    this.client.activate();
  }

  // Schedule a reconnect attempt with exponential backoff
  private scheduleReconnect(): void {
    if (this.manuallyDisconnected || this.reconnectTimer) return;
    const delay = Math.min(
      this.baseReconnectDelay * 2 ** Math.min(this.reconnectAttempts, 5),
      this.maxReconnectDelay
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectNow();
    }, delay);
  }

  /**
   * Attempt to re-establish the connection. Safe to call at any time; also
   * invoked automatically when the browser fires the `online` event.
   */
  reconnectNow(): void {
    this.manuallyDisconnected = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client?.active) return;
    if (!this.client) {
      this.connect();
      return;
    }
    this.client.reconnectDelay = this.baseReconnectDelay;
    this.client.activate();
  }

  private attachOnlineListener(): void {
    if (typeof window === 'undefined' || this.onlineListener) return;
    this.onlineListener = () => {
      console.log('[STOMP] Browser back online, reconnecting');
      this.reconnectNow();
    };
    window.addEventListener('online', this.onlineListener);
  }

  private detachOnlineListener(): void {
    if (typeof window === 'undefined' || !this.onlineListener) return;
    window.removeEventListener('online', this.onlineListener);
    this.onlineListener = null;
  }

  // Disconnect from STOMP server
  disconnect(): void {
    this.manuallyDisconnected = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detachOnlineListener();

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
    // Track current project for reconnection resubscription
    this.currentProjectId = projectId;
    this.currentProjectCallbacks = callbacks;

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
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
      this.currentProjectCallbacks = null;
    }
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
        callback(agentEventText(event) || message.body);
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
    // Remember the callback so it can be re-established after a reconnect.
    this.notificationCallback = callback;

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
    this.notificationCallback = null;
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

  /**
   * Send terminal input to backend via STOMP.
   *
   * NOTE: the gateway currently exposes **no** `@MessageMapping` for
   * `/app/project/{id}/terminal`, so this publish is never handled server-side.
   * Returns `false` when the message could not be handed to the broker.
   */
  sendTerminalInput(projectId: string, command: string): boolean {
    if (!this.client?.active) {
      console.warn('[STOMP] Cannot send terminal input: not connected');
      return false;
    }
    this.client.publish({
      destination: `/app/project/${projectId}/terminal`,
      body: JSON.stringify({ command }),
    });
    return true;
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
const AGENT_EVENT_TYPES: AgentEventType[] = [
  'TASK_STARTED',
  'AGENT_OUTPUT',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'AGENT_THINKING',
  'REVIEW_FINDING',
  'TEST_RESULT',
];

function isAgentEvent(event: unknown): event is AgentEvent {
  if (typeof event !== 'object' || event === null) return false;
  const obj = event as Record<string, unknown>;
  return AGENT_EVENT_TYPES.includes(obj.eventType as AgentEventType);
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
