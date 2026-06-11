package com.deepagent.scheduler.dto;

import com.deepagent.scheduler.entity.Task;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Task response DTO for API output.
 *
 * @param id           the task ID
 * @param name         the task name
 * @param description  the task description
 * @param projectId    the parent project ID
 * @param status       the task status
 * @param agentType    the agent type
 * @param input        the task input
 * @param output       the task output
 * @param dependencies list of dependency task IDs
 * @param retryCount   current retry count
 * @param maxRetries   maximum allowed retries
 * @param priority     task priority
 * @param startedAt    execution start timestamp
 * @param completedAt  execution completion timestamp
 * @param createdAt    creation timestamp
 * @param updatedAt    last update timestamp
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskResponse(

        Long id,
        String name,
        String description,
        Long projectId,
        Task.Status status,
        String agentType,
        String input,
        String output,
        List<Long> dependencies,
        Integer retryCount,
        Integer maxRetries,
        Integer priority,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt

) {}
