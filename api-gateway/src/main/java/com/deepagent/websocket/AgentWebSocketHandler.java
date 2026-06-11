package com.deepagent.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * WebSocket handler for broadcasting agent output to subscribed clients.
 *
 * <p>This handler uses Spring's STOMP messaging to push real-time agent
 * output to WebSocket clients. Clients subscribe to project-specific or
 * task-specific topics to receive updates.</p>
 *
 * <p>Topic structure:</p>
 * <ul>
 *   <li>{@code /topic/project/{projectId}} - all task events for a project</li>
 *   <li>{@code /topic/project/{projectId}/task/{taskId}} - output for a specific task</li>
 *   <li>{@code /user/queue/notifications} - user-specific notifications</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentWebSocketHandler {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcasts an agent output chunk to the project and task topics.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param output    the output chunk to broadcast
     */
    public void broadcastOutput(Long projectId, Long taskId, String output) {
        var message = new AgentOutputMessage(projectId, taskId, output, java.time.LocalDateTime.now());

        // Broadcast to project-level topic
        messagingTemplate.convertAndSend(
                "/topic/project/" + projectId, message);

        // Broadcast to task-specific topic
        messagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/task/" + taskId, message);

        log.debug("Broadcast agent output: projectId={}, taskId={}, length={}",
                projectId, taskId, output.length());
    }

    /**
     * Sends a notification to a specific user.
     *
     * @param userId  the user ID
     * @param message the notification message
     */
    public void notifyUser(Long userId, String message) {
        messagingTemplate.convertAndSendToUser(
                String.valueOf(userId),
                "/queue/notifications",
                new NotificationMessage(message, java.time.LocalDateTime.now()));

        log.debug("Sent notification to user: userId={}", userId);
    }

    /**
     * Agent output message payload for WebSocket transmission.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param output    the output content
     * @param timestamp the message timestamp
     */
    public record AgentOutputMessage(Long projectId, Long taskId, String output,
                                     java.time.LocalDateTime timestamp) {}

    /**
     * User notification message payload.
     *
     * @param message   the notification content
     * @param timestamp the message timestamp
     */
    public record NotificationMessage(String message, java.time.LocalDateTime timestamp) {}
}
