package com.deepagent.project.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.PageResponse;
import com.deepagent.common.util.ValidationUtil;
import com.deepagent.project.dto.ProjectRequest;
import com.deepagent.project.dto.ProjectResponse;
import com.deepagent.project.entity.Project;
import com.deepagent.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for project management operations.
 *
 * <p>Provides CRUD operations for projects with ownership validation.
 * 所有读取/写入都按 ownerId 限定（{@code findByIdAndOwnerId}），
 * 非所有者得到与“不存在”一致的 404 语义，避免通过状态码差异探测他人项目 ID。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectActivityService projectActivityService;

    /**
     * Creates a new project.
     *
     * @param request  the project creation request
     * @param ownerId  the ID of the user creating the project
     * @param actor    the username recorded in the activity log (may be null)
     * @return the created project response
     */
    @Transactional
    public ProjectResponse createProject(ProjectRequest request, Long ownerId, String actor) {
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
        projectActivityService.record(saved.getId(), "PROJECT_CREATED", saved.getName(), actor);
        return toResponse(saved);
    }

    /**
     * Retrieves a project by ID, scoped to its owner.
     *
     * @param projectId the project ID
     * @param ownerId   the requesting user's ID
     * @return the project response
     * @throws BusinessException if the project does not exist or is not owned by the user
     */
    @Transactional(readOnly = true)
    public ProjectResponse getProject(Long projectId, Long ownerId) {
        return toResponse(findOwnedProjectOrThrow(projectId, ownerId));
    }

    /**
     * Lists projects owned by a user with pagination.
     *
     * @param ownerId the owner's user ID
     * @param page    the page number (0-based)
     * @param size    the page size (1-100)
     * @return paginated project responses
     */
    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> listProjects(Long ownerId, int page, int size) {
        ValidationUtil.validatePagination(page, size);
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
     * @param actor     the username recorded in the activity log (may be null)
     * @return the updated project response
     * @throws BusinessException if the project is not found or the user is not the owner
     */
    @Transactional
    public ProjectResponse updateProject(Long projectId, ProjectRequest request, Long ownerId, String actor) {
        var project = findOwnedProjectOrThrow(projectId, ownerId);

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
        projectActivityService.record(saved.getId(), "PROJECT_UPDATED", saved.getName(), actor);
        return toResponse(saved);
    }

    /**
     * Soft-deletes a project by setting its status to DELETED.
     *
     * @param projectId the project ID
     * @param ownerId   the owner's user ID (for authorization)
     * @param actor     the username recorded in the activity log (may be null)
     * @throws BusinessException if the project is not found or the user is not the owner
     */
    @Transactional
    public void deleteProject(Long projectId, Long ownerId, String actor) {
        var project = findOwnedProjectOrThrow(projectId, ownerId);

        project.setStatus(Project.Status.DELETED);
        projectRepository.save(project);
        log.info("Project deleted: id={}", projectId);
        projectActivityService.record(projectId, "PROJECT_DELETED", project.getName(), actor);
    }

    /**
     * Finds a project by ID and owner, or throws a BusinessException.
     *
     * <p>是唯一允许的项目读取入口：service 层也做归属校验，避免绕过 controller 的调用方越权。</p>
     *
     * @param projectId the project ID
     * @param ownerId   the owner's user ID
     * @return the project entity
     * @throws BusinessException if not found or not owned by the user
     */
    private Project findOwnedProjectOrThrow(Long projectId, Long ownerId) {
        if (ownerId == null) {
            throw new BusinessException("Authentication required");
        }
        return projectRepository.findByIdAndOwnerId(projectId, ownerId)
                .orElseThrow(() -> new BusinessException("Project not found: " + projectId));
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
