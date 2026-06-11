package com.deepagent.scheduler.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Task creation/update request DTO.
 *
 * @param name         the task name
 * @param description  the task description
 * @param projectId    the parent project ID
 * @param agentType    the agent type to execute this task
 * @param input        the task input data as JSON
 * @param dependencies list of task IDs this task depends on
 * @param maxRetries   maximum retry count on failure
 * @param priority     task priority (higher = more important)
 */
public record TaskRequest(

        @NotBlank(message = "Task name is required")
        @Size(min = 1, max = 200, message = "Task name must be between 1 and 200 characters")
        String name,

        @Size(max = 2000, message = "Description must not exceed 2000 characters")
        String description,

        @NotNull(message = "Project ID is required")
        Long projectId,

        @Size(max = 50, message = "Agent type must not exceed 50 characters")
        String agentType,

        @Size(max = 5000, message = "Input must not exceed 5000 characters")
        String input,

        List<Long> dependencies,

        Integer maxRetries,

        Integer priority

) {}
