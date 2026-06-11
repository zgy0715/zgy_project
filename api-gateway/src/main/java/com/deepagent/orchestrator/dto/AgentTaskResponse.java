package com.deepagent.orchestrator.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

/**
 * Agent task response DTO for returning agent execution results.
 *
 * @param taskId     the task ID
 * @param projectId  the project ID
 * @param agentType  the agent type that was invoked
 * @param status     the execution status
 * @param output     the agent output
 * @param startedAt  execution start timestamp
 * @param completedAt execution completion timestamp
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentTaskResponse(

        Long taskId,
        Long projectId,
        String agentType,
        String status,
        String output,
        LocalDateTime startedAt,
        LocalDateTime completedAt

) {
    /**
     * Creates a running status response.
     *
     * @param taskId    the task ID
     * @param projectId the project ID
     * @param agentType the agent type
     * @return a response indicating the task is running
     */
    public static AgentTaskResponse running(Long taskId, Long projectId, String agentType) {
        return new AgentTaskResponse(taskId, projectId, agentType, "RUNNING",
                null, LocalDateTime.now(), null);
    }

    /**
     * Creates a completed status response.
     *
     * @param taskId      the task ID
     * @param projectId   the project ID
     * @param agentType   the agent type
     * @param output      the agent output
     * @param startedAt   the start timestamp
     * @return a response indicating the task completed successfully
     */
    public static AgentTaskResponse completed(Long taskId, Long projectId,
                                              String agentType, String output,
                                              LocalDateTime startedAt) {
        return new AgentTaskResponse(taskId, projectId, agentType, "SUCCESS",
                output, startedAt, LocalDateTime.now());
    }

    /**
     * Creates a failed status response.
     *
     * @param taskId    the task ID
     * @param projectId the project ID
     * @param agentType the agent type
     * @param error     the error message
     * @param startedAt the start timestamp
     * @return a response indicating the task failed
     */
    public static AgentTaskResponse failed(Long taskId, Long projectId,
                                           String agentType, String error,
                                           LocalDateTime startedAt) {
        return new AgentTaskResponse(taskId, projectId, agentType, "FAILED",
                error, startedAt, LocalDateTime.now());
    }
}
