"""Event push service using WebSocket for real-time updates.

TODO: STOMP兼容性 - 当前 EventService 使用原生 WebSocket 协议推送事件，
与前端 STOMP 协议不兼容。前端通过 API Gateway 的 STOMP 代理接收事件，
不直接连接 Agent Runtime 的 WebSocket。未来需要移除此原生 WebSocket 实现，
或改造为通过 RabbitMQ/消息队列将事件发送到 API Gateway，由 Gateway 统一
通过 STOMP 协议推送给前端。
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EventService:
    """Service for pushing real-time events to WebSocket clients.

    Manages WebSocket connections and broadcasts events to
    connected clients for real-time UI updates.

    Example:
        >>> service = EventService()
        >>> await service.connect(websocket, "client-1")
        >>> await service.broadcast("agent.started", {"agent_id": "123"})
    """

    def __init__(self) -> None:
        """Initialize the event service."""
        self._connections: dict[str, WebSocket] = {}
        self._event_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Accept and register a new WebSocket connection.

        Args:
            websocket: The WebSocket connection.
            client_id: Unique identifier for the client.
        """
        await websocket.accept()
        self._connections[client_id] = websocket
        logger.info("WebSocket client connected: %s", client_id)

    async def disconnect(self, client_id: str) -> None:
        """Remove a WebSocket connection.

        Args:
            client_id: Unique identifier for the client.
        """
        self._connections.pop(client_id, None)
        logger.info("WebSocket client disconnected: %s", client_id)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> int:
        """Broadcast an event to all connected clients.

        Args:
            event_type: Type of the event (e.g., "agent.started").
            data: Event payload data.

        Returns:
            Number of clients that received the event.
        """
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        message = json.dumps(event)
        sent_count = 0
        failed_clients: list[str] = []

        for client_id, websocket in self._connections.items():
            try:
                await websocket.send_text(message)
                sent_count += 1
            except Exception as e:
                logger.warning(
                    "Failed to send event to client %s: %s",
                    client_id,
                    str(e),
                )
                failed_clients.append(client_id)

        # Clean up failed connections
        for client_id in failed_clients:
            self._connections.pop(client_id, None)

        logger.debug(
            "Broadcast event '%s' to %d clients",
            event_type,
            sent_count,
        )

        return sent_count

    async def send_to(self, client_id: str, event_type: str, data: dict[str, Any]) -> bool:
        """Send an event to a specific client.

        Args:
            client_id: Target client identifier.
            event_type: Type of the event.
            data: Event payload data.

        Returns:
            True if the event was sent successfully.
        """
        websocket = self._connections.get(client_id)
        if not websocket:
            logger.warning("Client %s not connected", client_id)
            return False

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            await websocket.send_text(json.dumps(event))
            return True
        except Exception as e:
            logger.error("Failed to send event to %s: %s", client_id, str(e))
            await self.disconnect(client_id)
            return False

    async def emit_agent_event(
        self,
        agent_id: str,
        event_type: str,
        details: dict[str, Any] | None = None,
    ) -> int:
        """Emit an agent-related event.

        Convenience method for common agent events.

        Args:
            agent_id: The agent that triggered the event.
            event_type: Agent event type (e.g., "started", "completed").
            details: Optional event details.

        Returns:
            Number of clients that received the event.
        """
        return await self.broadcast(
            event_type=f"agent.{event_type}",
            data={
                "agent_id": agent_id,
                **(details or {}),
            },
        )

    async def emit_workflow_event(
        self,
        workflow_id: str,
        event_type: str,
        details: dict[str, Any] | None = None,
    ) -> int:
        """Emit a workflow-related event.

        Args:
            workflow_id: The workflow that triggered the event.
            event_type: Workflow event type.
            details: Optional event details.

        Returns:
            Number of clients that received the event.
        """
        return await self.broadcast(
            event_type=f"workflow.{event_type}",
            data={
                "workflow_id": workflow_id,
                **(details or {}),
            },
        )

    @property
    def connection_count(self) -> int:
        """Return the number of active WebSocket connections."""
        return len(self._connections)
