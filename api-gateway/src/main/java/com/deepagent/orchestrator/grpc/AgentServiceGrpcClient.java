package com.deepagent.orchestrator.grpc;

import com.deepagent.orchestrator.dto.AgentTaskResponse;
import io.grpc.ManagedChannel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * gRPC client for communicating with the Python agent service.
 *
 * <p>This client handles synchronous and streaming gRPC calls to the
 * Python-based agent execution service. It provides:</p>
 * <ul>
 *   <li>Synchronous task execution for simple agent invocations</li>
 *   <li>Server-streaming for real-time agent output</li>
 *   <li>Connection management with keep-alive and timeout handling</li>
 * </ul>
 *
 * <p>Note: The actual gRPC stub classes will be generated from the proto file
 * at build time. This class provides the skeleton with placeholder calls
 * that should be replaced with generated stub invocations.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentServiceGrpcClient {

    private final ManagedChannel agentServiceChannel;

    /**
     * Submits a task to the Python agent service synchronously.
     *
     * <p>Sends the task request and waits for the agent to complete execution.
     * For long-running tasks, prefer using the streaming method instead.</p>
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the type of agent to invoke
     * @param input     the task input data
     * @return the agent task response with output
     */
    public AgentTaskResponse submitTask(Long projectId, Long taskId,
                                         String agentType, String input) {
        log.info("Submitting task to agent service: projectId={}, taskId={}, agentType={}",
                projectId, taskId, agentType);

        try {
            // TODO: Replace with actual gRPC stub call once proto is compiled
            // Example:
            // var request = AgentTaskRequest.newBuilder()
            //         .setProjectId(projectId)
            //         .setTaskId(taskId)
            //         .setAgentType(agentType)
            //         .setInput(input)
            //         .build();
            //
            // var blockingStub = AgentServiceGrpc.newBlockingStub(agentServiceChannel);
            // var response = blockingStub.withDeadlineAfter(300, TimeUnit.SECONDS)
            //         .executeTask(request);

            // Placeholder response for skeleton
            log.info("Task submitted successfully (placeholder): taskId={}", taskId);
            return AgentTaskResponse.completed(taskId, projectId, agentType,
                    "Agent execution completed (placeholder)", java.time.LocalDateTime.now());

        } catch (Exception e) {
            log.error("Failed to submit task to agent service: taskId={}, error={}",
                    taskId, e.getMessage());
            return AgentTaskResponse.failed(taskId, projectId, agentType,
                    e.getMessage(), java.time.LocalDateTime.now());
        }
    }

    /**
     * Submits a task with server-side streaming for real-time output.
     *
     * <p>The agent service streams output chunks as they are produced,
     * allowing the gateway to forward them to clients via WebSocket.</p>
     *
     * @param projectId the project ID
     * @param taskId    the task ID
     * @param agentType the type of agent to invoke
     * @param input     the task input data
     * @param outputHandler callback for processing each output chunk
     */
    public void submitTaskStream(Long projectId, Long taskId,
                                  String agentType, String input,
                                  java.util.function.Consumer<String> outputHandler) {
        log.info("Submitting streaming task to agent service: projectId={}, taskId={}, agentType={}",
                projectId, taskId, agentType);

        try {
            // TODO: Replace with actual gRPC streaming stub call once proto is compiled
            // Example:
            // var request = AgentTaskRequest.newBuilder()
            //         .setProjectId(projectId)
            //         .setTaskId(taskId)
            //         .setAgentType(agentType)
            //         .setInput(input)
            //         .setStream(true)
            //         .build();
            //
            // var asyncStub = AgentServiceGrpc.newStub(agentServiceChannel);
            // var streamObserver = new StreamObserver<>() { ... };

            // Placeholder: simulate streaming output
            outputHandler.accept("Agent execution started for task: " + taskId);
            outputHandler.accept("Processing with agent type: " + agentType);
            outputHandler.accept("Agent execution completed (placeholder)");

            log.info("Streaming task completed (placeholder): taskId={}", taskId);

        } catch (Exception e) {
            log.error("Failed during streaming task execution: taskId={}, error={}",
                    taskId, e.getMessage());
            outputHandler.accept("ERROR: " + e.getMessage());
        }
    }

    /**
     * Checks the health of the agent service connection.
     *
     * @return true if the agent service is reachable
     */
    public boolean isHealthy() {
        try {
            var state = agentServiceChannel.getState(false);
            return !state.isTerminalState();
        } catch (Exception e) {
            log.warn("Agent service health check failed: {}", e.getMessage());
            return false;
        }
    }
}
