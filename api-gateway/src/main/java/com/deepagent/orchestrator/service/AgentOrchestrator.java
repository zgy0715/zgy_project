package com.deepagent.orchestrator.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.dto.AgentTaskRequest;
import com.deepagent.orchestrator.dto.AgentTaskResponse;
import com.deepagent.orchestrator.grpc.AgentServiceGrpcClient;
import com.deepagent.websocket.AgentEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Agent orchestrator service that coordinates task execution across AI agents.
 *
 * <p>This service acts as the central coordination point between the Java
 * gateway and the Python agent service. It handles:</p>
 * <ul>
 *   <li>Task submission to the appropriate agent type</li>
 *   <li>Real-time output streaming via WebSocket</li>
 *   <li>Result aggregation and error handling</li>
 *   <li>Event publishing for downstream consumers</li>
 * </ul>
 *
 * <p>Communication with the Python agent service is done via gRPC,
 * managed by {@link AgentServiceGrpcClient}.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrchestrator {

    private final AgentServiceGrpcClient grpcClient;
    private final AgentEventPublisher eventPublisher;

    /**
     * Executes an agent task via gRPC and returns the result.
     *
     * <p>For non-streaming tasks, this method blocks until the agent
     * completes execution and returns the full output.</p>
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the type of agent to invoke
     * @param input     the task input data
     * @return the agent output string
     */
    public String executeAgentTask(Long projectId, Long taskId,
                                   String agentType, String input) {
        log.info("Executing agent task: projectId={}, taskId={}, agentType={}",
                projectId, taskId, agentType);

        // Publish task started event
        eventPublisher.publishTaskStarted(projectId, taskId, agentType);

        try {
            var response = grpcClient.submitTask(projectId, taskId, agentType, input);

            if ("SUCCESS".equals(response.status())) {
                eventPublisher.publishTaskCompleted(projectId, taskId, agentType, response.output());
                return response.output();
            } else {
                eventPublisher.publishTaskFailed(projectId, taskId, agentType, response.output());
                throw new BusinessException("Agent task failed: " + response.output());
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            eventPublisher.publishTaskFailed(projectId, taskId, agentType, e.getMessage());
            throw new BusinessException("Agent task execution error: " + e.getMessage());
        }
    }

    /**
     * Executes an agent task with real-time output streaming.
     *
     * <p>Streams agent output chunks via WebSocket as they are produced.
     * The client can subscribe to the WebSocket topic to receive updates.</p>
     *
     * @param request the agent task request
     * @return the initial task response (status = RUNNING)
     */
    public AgentTaskResponse executeAgentTaskStream(AgentTaskRequest request) {
        log.info("Executing streaming agent task: projectId={}, taskId={}, agentType={}",
                request.projectId(), request.taskId(), request.agentType());

        // Publish task started event
        eventPublisher.publishTaskStarted(request.projectId(), request.taskId(), request.agentType());

        // Start streaming in a virtual thread
        Thread.startVirtualThread(() -> {
            try {
                grpcClient.submitTaskStream(
                        request.projectId(),
                        request.taskId(),
                        request.agentType(),
                        request.input(),
                        chunk -> eventPublisher.publishAgentOutput(
                                request.projectId(), request.taskId(), chunk)
                );
                eventPublisher.publishTaskCompleted(
                        request.projectId(), request.taskId(), request.agentType(), "Stream completed");
            } catch (Exception e) {
                eventPublisher.publishTaskFailed(
                        request.projectId(), request.taskId(), request.agentType(), e.getMessage());
            }
        });

        return AgentTaskResponse.running(request.taskId(), request.projectId(), request.agentType());
    }

    /**
     * Checks the health of the agent service.
     *
     * @return true if the agent service is reachable
     */
    public boolean isAgentServiceHealthy() {
        return grpcClient.isHealthy();
    }
}
