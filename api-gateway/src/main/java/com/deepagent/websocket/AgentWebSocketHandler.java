package com.deepagent.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * WebSocket handler for user-targeted notifications.
 *
 * <p>Uses Spring's STOMP messaging to push notifications to a single user's
 * session. Project/task lifecycle events are NOT sent from here: they are
 * published as a uniform {@code AgentEvent} envelope on
 * {@code /topic/project/{projectId}} and
 * {@code /topic/project/{projectId}/task/{taskId}} by
 * {@link AgentEventPublisher}.</p>
 *
 * <p>Destination structure:</p>
 * <ul>
 *   <li>{@code /user/queue/notifications} - notifications for the current user</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentWebSocketHandler {

    // 通知类型：与前端 NOTIFICATION_ICONS 的键完全一致（冻结契约，不得随意新增/改名）。
    public static final String TYPE_TASK_COMPLETED = "TASK_COMPLETED";
    public static final String TYPE_TASK_FAILED = "TASK_FAILED";
    public static final String TYPE_WORKFLOW_COMPLETED = "WORKFLOW_COMPLETED";
    public static final String TYPE_WORKFLOW_FAILED = "WORKFLOW_FAILED";
    public static final String TYPE_REVIEW_FINDING = "REVIEW_FINDING";
    public static final String TYPE_INFO = "INFO";

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Sends a notification to a specific user.
     *
     * <p>目标用户必须用 STOMP principal 的名字（即用户名）指定：Spring 的 user
     * destination 解析依赖于会话 principal 的 {@code getName()}，而本项目的
     * principal 由 {@code WebSocketAuthInterceptor} 基于 {@code UserDetails} 构造，
     * 其 name 是用户名而不是数据库自增 id。传数值 id 会导致消息永远无法投递
     * （前端订阅的是 {@code /user/queue/notifications}）。</p>
     *
     * @param username the username of the target user (STOMP principal name)
     * @param type     the notification type, one of the {@code TYPE_*} constants
     *                 (the frontend picks its icon/title from this value)
     * @param message  the notification message
     */
    public void notifyUser(String username, String type, String message) {
        if (username == null || username.isBlank()) {
            log.warn("Skipped {} notification because no target username was provided: message={}",
                    type, message);
            return;
        }

        messagingTemplate.convertAndSendToUser(
                username,
                "/queue/notifications",
                new NotificationMessage(type, message, LocalDateTime.now()));

        log.debug("Sent notification to user: username={}, type={}", username, type);
    }

    /**
     * User notification message payload.
     *
     * <p>字段与前端契约一致：{@code {type, message, timestamp}}，其中 {@code type}
     * 用于选择图标与标题。</p>
     *
     * @param type      the notification type
     * @param message   the notification content
     * @param timestamp the message timestamp
     */
    public record NotificationMessage(String type, String message, LocalDateTime timestamp) {}
}
