// WebSocket client for DeepAgent platform real-time communication

import { io, Socket } from 'socket.io-client';
import { WS_EVENTS, STORAGE_KEYS } from './constants';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8080/ws';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Connect to WebSocket server
  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    const token = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      : null;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WS] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message);
      this.reconnectAttempts++;
    });
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Join a project room for project-specific events
  joinProject(projectId: string): void {
    this.socket?.emit('join_project', { projectId });
  }

  // Leave a project room
  leaveProject(projectId: string): void {
    this.socket?.emit('leave_project', { projectId });
  }

  // Subscribe to agent messages
  onAgentMessage(callback: (data: unknown) => void): void {
    this.socket?.on(WS_EVENTS.AGENT_MESSAGE, callback);
  }

  // Subscribe to agent status changes
  onAgentStatus(callback: (data: unknown) => void): void {
    this.socket?.on(WS_EVENTS.AGENT_STATUS, callback);
  }

  // Subscribe to workflow updates
  onWorkflowUpdate(callback: (data: unknown) => void): void {
    this.socket?.on(WS_EVENTS.WORKFLOW_UPDATE, callback);
  }

  // Subscribe to notifications
  onNotification(callback: (data: unknown) => void): void {
    this.socket?.on(WS_EVENTS.NOTIFICATION, callback);
  }

  // Remove a specific event listener
  off(event: string, callback?: (data: unknown) => void): void {
    this.socket?.off(event, callback);
  }

  // Get the raw socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
