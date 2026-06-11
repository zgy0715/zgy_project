package com.deepagent.project.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.PageResponse;
import com.deepagent.project.dto.ProjectRequest;
import com.deepagent.project.dto.ProjectResponse;
import com.deepagent.project.entity.Project;
import com.deepagent.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for project management operations.
 *
 * <p>Provides CRUD operations for projects with ownership validation.
 * Only the project owner can modify or delete a project.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    /**
     * Creates a new project.
     *
     * @param request  the project creation request
     * @param ownerId  the ID of the user creating the project
     * @return the created project response
     */
    @Transactional
    public ProjectResponse createProject(ProjectRequest request, Long ownerId) {
        var project = Project.builder()
                .name(request.name())
                .description(request.description())
                .ownerId(ownerId)
                .agentType(request.agentType())
                .config(request.config())
                .status(Project.Status.ACTIVE)
                .build();

        var saved = projectRepository.save(project);
        log.info("Project created: id={}, name={}, owner={}", saved.getId(), saved.getName(), ownerId);
        return toResponse(saved);
    }

    /**
     * Retrieves a project by ID.
     *
     * @param projectId the project ID
     * @return the project response
     * @throws BusinessException if the project is not found
     */
    @Transactional(readOnly = true)
    public ProjectResponse getProject(Long projectId) {
        var project = findProjectOrThrow(projectId);
        return toResponse(project);
    }

    /**
     * Lists projects owned by a user with pagination.
     *
     * @param ownerId the owner's user ID
     * @param page    the page number (0-based)
     * @param size    the page size
     * @return paginated project responses
     */
    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> listProjects(Long ownerId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        var projectPage = projectRepository.findByOwnerId(ownerId, pageable);
        return PageResponse.from(projectPage.map(this::toResponse));
    }

    /**
     * Updates an existing project.
     *
     * @param projectId the project ID
     * @param request   the update request
     * @param ownerId   the owner's user ID (for authorization)
     * @return the updated project response
     * @throws BusinessException if the project is not found or the user is not the owner
     */
    @Transactional
    public ProjectResponse updateProject(Long projectId, ProjectRequest request, Long ownerId) {
        var project = findProjectOrThrow(projectId);
        validateOwnership(project, ownerId);

        if (request.name() != null) {
            project.setName(request.name());
        }
        if (request.description() != null) {
            project.setDescription(request.description());
        }
        if (request.agentType() != null) {
            project.setAgentType(request.agentType());
        }
        if (request.config() != null) {
            project.setConfig(request.config());
        }

        var saved = projectRepository.save(project);
        log.info("Project updated: id={}", saved.getId());
        return toResponse(saved);
    }

    /**
     * Soft-deletes a project by setting its status to DELETED.
     *
     * @param projectId the project ID
     * @param ownerId   the owner's user ID (for authorization)
     * @throws BusinessException if the project is not found or the user is not the owner
     */
    @Transactional
    public void deleteProject(Long projectId, Long ownerId) {
        var project = findProjectOrThrow(projectId);
        validateOwnership(project, ownerId);

        project.setStatus(Project.Status.DELETED);
        projectRepository.save(project);
        log.info("Project deleted: id={}", projectId);
    }

    /**
     * Finds a project by ID or throws a BusinessException.
     *
     * @param projectId the project ID
     * @return the project entity
     * @throws BusinessException if not found
     */
    private Project findProjectOrThrow(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException("Project not found: " + projectId));
    }

    /**
     * Validates that the given user is the owner of the project.
     *
     * @param project the project entity
     * @param ownerId the user ID to validate
     * @throws BusinessException if the user is not the owner
     */
    private void validateOwnership(Project project, Long ownerId) {
        if (!project.getOwnerId().equals(ownerId)) {
            throw new BusinessException("You are not authorized to modify this project");
        }
    }

    /**
     * Converts a Project entity to a ProjectResponse DTO.
     *
     * @param project the project entity
     * @return the project response DTO
     */
    private ProjectResponse toResponse(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getOwnerId(),
                project.getStatus(),
                project.getAgentType(),
                project.getConfig(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
