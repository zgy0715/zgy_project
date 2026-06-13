package com.deepagent.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

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
        var event = new AgentEvent("TASK_STARTED", projectId, taskId, agentType, null);

        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_TASK_ROUTING_KEY, event);
        webSocketHandler.broadcastOutput(projectId, taskId,
                "Task started with agent type: " + agentType);

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
        var event = new AgentEvent("AGENT_OUTPUT", projectId, taskId, null, output);

        rabbitTemplate.convertAndSend(AGENT_OUTPUT_EXCHANGE, AGENT_OUTPUT_ROUTING_KEY, event);
        webSocketHandler.broadcastOutput(projectId, taskId, output);

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
        var event = new AgentEvent("TASK_COMPLETED", projectId, taskId, agentType, output);

        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_RESULT_ROUTING_KEY, event);
        webSocketHandler.broadcastOutput(projectId, taskId,
                "Task completed: " + (output != null ? output.substring(0, Math.min(output.length(), 100)) : "no output"));

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
        var event = new AgentEvent("TASK_FAILED", projectId, taskId, agentType, error);

        rabbitTemplate.convertAndSend(AGENT_EXCHANGE, AGENT_RESULT_ROUTING_KEY, event);
        messagingTemplate.convertAndSend("/topic/project/" + projectId, event);
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/task/" + taskId, event);

        log.debug("Published TASK_FAILED event: projectId={}, taskId={}", projectId, taskId);
    }

    /**
     * Agent event record for RabbitMQ message publishing.
     *
     * @param eventType the event type
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the agent type
     * @param data      the event data (output or error)
     */
    public record AgentEvent(String eventType, Long projectId, Long taskId,
                             String agentType, String data) {}
}
