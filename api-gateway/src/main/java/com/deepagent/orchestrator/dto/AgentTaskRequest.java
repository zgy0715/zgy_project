package com.deepagent.orchestrator.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Agent task request DTO for submitting tasks to AI agents.
 *
 * @param projectId  the project ID this task belongs to
 * @param taskId     the task ID (optional, for DAG tasks)
 * @param agentType  the type of agent to invoke (e.g., "code-review", "test-gen")
 * @param input      the task input data as JSON
 * @param stream     whether to stream the agent output in real-time
 */
public record AgentTaskRequest(

        @NotNull(message = "Project ID is required")
        Long projectId,

        Long taskId,

        @NotBlank(message = "Agent type is required")
        @Size(max = 50, message = "Agent type must not exceed 50 characters")
        String agentType,

        @Size(max = 10000, message = "Input must not exceed 10000 characters")
        String input,

        @NotNull(message = "Stream flag is required")
        Boolean stream

) {}
