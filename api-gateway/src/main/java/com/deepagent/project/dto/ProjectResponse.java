package com.deepagent.project.dto;

import com.deepagent.project.entity.Project;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

/**
 * Project response DTO for API output.
 *
 * @param id          the project ID
 * @param name        the project name
 * @param description the project description
 * @param ownerId     the owner's user ID
 * @param status      the project status
 * @param agentType   the default agent type
 * @param config      the project configuration
 * @param createdAt   the creation timestamp
 * @param updatedAt   the last update timestamp
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProjectResponse(

        Long id,
        String name,
        String description,
        Long ownerId,
        Project.Status status,
        String agentType,
        String config,
        LocalDateTime createdAt,
        LocalDateTime updatedAt

) {}
