package com.deepagent.project.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.project.dto.ActivityResponse;
import com.deepagent.project.entity.ProjectActivity;
import com.deepagent.project.repository.ProjectActivityRepository;
import com.deepagent.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 项目动态服务：写入与查询 project_activity（V2 迁移新增表）。
 *
 * <p>动态写入失败不应影响主业务，因此 {@link #record} 内部吞掉异常并记录日志。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectActivityService {

    /** 列表查询的默认与最大条数。 */
    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    private final ProjectActivityRepository projectActivityRepository;
    private final ProjectRepository projectRepository;

    /**
     * 记录一条项目动态。异常不向上抛出。
     */
    @Transactional
    public void record(Long projectId, String type, String message, String actor) {
        if (projectId == null || type == null) {
            return;
        }
        try {
            projectActivityRepository.save(ProjectActivity.builder()
                    .projectId(projectId)
                    .type(type)
                    .message(message)
                    .actor(actor)
                    .build());
        } catch (RuntimeException e) {
            log.warn("Failed to record activity for project {}: {}", projectId, e.getMessage());
        }
    }

    /**
     * 查询项目动态（仅项目所有者可见）。
     */
    @Transactional(readOnly = true)
    public List<ActivityResponse> list(Long projectId, Long ownerId, Integer limit) {
        requireOwnedProject(projectId, ownerId);
        int size = limit == null ? DEFAULT_LIMIT : Math.min(Math.max(limit, 1), MAX_LIMIT);
        return projectActivityRepository
                .findByProjectIdOrderByCreatedAtDesc(projectId, PageRequest.of(0, size))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void requireOwnedProject(Long projectId, Long ownerId) {
        if (ownerId == null) {
            throw new BusinessException("Authentication required");
        }
        projectRepository.findByIdAndOwnerId(projectId, ownerId)
                .orElseThrow(() -> new BusinessException("Project not found: " + projectId));
    }

    private ActivityResponse toResponse(ProjectActivity activity) {
        return new ActivityResponse(
                activity.getId(),
                activity.getProjectId(),
                activity.getType(),
                activity.getMessage(),
                activity.getActor(),
                activity.getCreatedAt()
        );
    }
}
