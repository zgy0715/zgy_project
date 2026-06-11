package com.deepagent.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Project creation/update request DTO.
 *
 * @param name        the project name
 * @param description the project description
 * @param agentType   the default agent type for the project
 * @param config      the project configuration as JSON string
 */
public record ProjectRequest(

        @NotBlank(message = "Project name is required")
        @Size(min = 1, max = 200, message = "Project name must be between 1 and 200 characters")
        String name,

        @Size(max = 2000, message = "Description must not exceed 2000 characters")
        String description,

        @Size(max = 50, message = "Agent type must not exceed 50 characters")
        String agentType,

        @Size(max = 5000, message = "Config must not exceed 5000 characters")
        String config

) {}
