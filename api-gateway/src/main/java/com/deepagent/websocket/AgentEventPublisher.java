package com.deepagent.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

import static com.deepagent.config.RabbitMQConfig.*;

/**
 * Event publisher for agent task lifecycle events.
 *
 * <p>Publishes events through two channels:</p>
 * <ol>
 *   <li><b>RabbitMQ</b>: For cross-service event propagation and persistence</li>
 *   <li><b>WebSocket</b>: For real-time client notifications</li>
 * </ol>
 *
 * <p>所有生命周期事件（TASK_STARTED / AGENT_OUTPUT / TASK_COMPLETED / TASK_FAILED）
 * 都以统一的 {@link AgentEvent} 信封发送到 {@code /topic/project/{projectId}} 与
 * {@code /topic/project/{projectId}/task/{taskId}}：前端的 {@code isAgentEvent()}
 * 守卫要求 {@code eventType} 字段，缺少该字段的消息会被直接丢弃，因此四个事件
 * 必须共用同一信封（文本载荷字段名固定为 {@code data}）。</p>
 *
 * <p>Events published:</p>
 * <ul>
 *   <li>Task started - when an agent begins processing</li>
 *   <li>Agent output - streaming output chunks during execution</li>
 *   <li>Task completed - when an agent finishes successfully</li>
 *   <li>Task failed - when an agent encounters an error</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Publishes a task started event.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the agent type
     */
    public void publishTaskStarted(Long projectId, Long taskId, String agentType) {
        var event = new AgentEvent("TASK_STARTED", projectId, taskId, agentType, null, LocalDateTime.now());

        // TASK_STARTED 属于生命周期事件，走 result routing key；
        // 发到 AGENT_TASK_ROUTING_KEY 会把它投递到任务提交队列，被下游当成待执行任务消费。
        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_RESULT_ROUTING_KEY, event);
        publishToProjectTopics(projectId, taskId, event);

        log.debug("Published TASK_STARTED event: projectId={}, taskId={}", projectId, taskId);
    }

    /**
     * Publishes an agent output chunk event.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param output    the output chunk
     */
    public void publishAgentOutput(Long projectId, Long taskId, String output) {
        var event = new AgentEvent("AGENT_OUTPUT", projectId, taskId, null, output, LocalDateTime.now());

        rabbitTemplate.convertAndSend(AGENT_OUTPUT_EXCHANGE, AGENT_OUTPUT_ROUTING_KEY, event);
        publishToProjectTopics(projectId, taskId, event);

        log.debug("Published AGENT_OUTPUT event: projectId={}, taskId={}", projectId, taskId);
    }

    /**
     * Publishes a task completed event.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the agent type
     * @param output    the final output
     */
    public void publishTaskCompleted(Long projectId, Long taskId, String agentType, String output) {
        var event = new AgentEvent("TASK_COMPLETED", projectId, taskId, agentType, output, LocalDateTime.now());

        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_RESULT_ROUTING_KEY, event);
        publishToProjectTopics(projectId, taskId, event);

        log.debug("Published TASK_COMPLETED event: projectId={}, taskId={}", projectId, taskId);
    }

    /**
     * Publishes a task failed event.
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the agent type
     * @param error     the error message
     */
    public void publishTaskFailed(Long projectId, Long taskId, String agentType, String error) {
        var event = new AgentEvent("TASK_FAILED", projectId, taskId, agentType, error, LocalDateTime.now());

        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_RESULT_ROUTING_KEY, event);
        publishToProjectTopics(projectId, taskId, event);

        log.debug("Published TASK_FAILED event: projectId={}, taskId={}", projectId, taskId);
    }

    /**
     * 把事件信封发到项目级与任务级两个 topic（WebSocket 订阅端按项目或按任务订阅）。
     */
    private void publishToProjectTopics(Long projectId, Long taskId, AgentEvent event) {
        messagingTemplate.convertAndSend("/topic/project/" + projectId, event);
        if (taskId != null) {
            messagingTemplate.convertAndSend("/topic/project/" + projectId + "/task/" + taskId, event);
        }
    }

    /**
     * Agent event record for RabbitMQ message publishing.
     *
     * <p>字段顺序即前端约定的信封：
     * {@code {eventType, projectId, taskId, agentType, data, timestamp}}。</p>
     *
     * @param eventType the event type
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the agent type
     * @param data      the event data (output or error)
     * @param timestamp the event timestamp
     */
    public record AgentEvent(String eventType, Long projectId, Long taskId,
                             String agentType, String data, LocalDateTime timestamp) {}
}
