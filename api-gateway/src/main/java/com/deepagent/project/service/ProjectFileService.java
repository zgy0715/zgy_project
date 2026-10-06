package com.deepagent.project.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.project.dto.ProjectFileCreateRequest;
import com.deepagent.project.dto.ProjectFileResponse;
import com.deepagent.project.entity.ProjectFile;
import com.deepagent.project.repository.ProjectFileRepository;
import com.deepagent.project.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 项目文件服务：project_files（V2 迁移新增表）。
 *
 * <p>所有方法都先校验项目归属，非所有者与不存在的项目返回同样的 “Project not found”，
 * 避免通过 404/403 差异探测他人项目 ID。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectFileService {

    private final ProjectFileRepository projectFileRepository;
    private final ProjectRepository projectRepository;
    private final ProjectActivityService projectActivityService;

    @Transactional(readOnly = true)
    public List<ProjectFileResponse> listFiles(Long projectId, Long ownerId) {
        requireOwnedProject(projectId, ownerId);
        return projectFileRepository.findByProjectIdOrderByPathAsc(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectFileResponse getFile(Long projectId, Long fileId, Long ownerId) {
        requireOwnedProject(projectId, ownerId);
        return toResponse(findFileOrThrow(projectId, fileId));
    }

    /**
     * 创建（或按 path 覆盖）项目文件。
     */
    @Transactional
    public ProjectFileResponse createFile(Long projectId, ProjectFileCreateRequest request,
                                          Long ownerId, String actor) {
        requireOwnedProject(projectId, ownerId);

        var path = request.path() == null ? null : request.path().trim();
        if (path == null || path.isEmpty()) {
            throw new BusinessException("File path is required");
        }

        var existing = projectFileRepository.findByProjectIdAndPath(projectId, path).orElse(null);
        ProjectFile file;
        String eventType;
        if (existing != null) {
            file = existing;
            eventType = "FILE_UPDATED";
        } else {
            file = ProjectFile.builder()
                    .projectId(projectId)
                    .path(path)
                    .name(resolveName(request.name(), path))
                    .build();
            eventType = "FILE_CREATED";
        }
        if (request.name() != null && !request.name().isBlank()) {
            file.setName(request.name().trim());
        }
        if (request.content() != null) {
            file.setContent(request.content());
        }
        if (request.language() != null) {
            file.setLanguage(request.language());
        }

        var saved = projectFileRepository.save(file);
        log.info("Project file {} saved: projectId={}, path={}, user={}", eventType, projectId, path, ownerId);
        projectActivityService.record(projectId, eventType, path, actor);
        return toResponse(saved);
    }

    /**
     * 更新文件内容（content 为 null 时表示内容不变）。
     */
    @Transactional
    public ProjectFileResponse updateFile(Long projectId, Long fileId, String content,
                                          Long ownerId, String actor) {
        requireOwnedProject(projectId, ownerId);
        var file = findFileOrThrow(projectId, fileId);

        if (content != null) {
            file.setContent(content);
        }
        var saved = projectFileRepository.save(file);
        log.info("Project file updated: projectId={}, fileId={}, user={}", projectId, fileId, ownerId);
        projectActivityService.record(projectId, "FILE_UPDATED", saved.getPath(), actor);
        return toResponse(saved);

    }

    private ProjectFile findFileOrThrow(Long projectId, Long fileId) {
        // findByIdAndProjectId 同时限定 fileId 与 projectId，防止跨项目读取文件（IDOR）。
        return projectFileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new BusinessException("File not found: " + fileId));
    }

    private void requireOwnedProject(Long projectId, Long ownerId) {
        if (ownerId == null) {
            throw new BusinessException("Authentication required");
        }
        projectRepository.findByIdAndOwnerId(projectId, ownerId)
                .orElseThrow(() -> new BusinessException("Project not found: " + projectId));
    }

    private String resolveName(String requestedName, String path) {
        if (requestedName != null && !requestedName.isBlank()) {
            return requestedName.trim();
        }
        int slash = path.lastIndexOf('/');
        var name = slash >= 0 ? path.substring(slash + 1) : path;
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    private ProjectFileResponse toResponse(ProjectFile file) {
        return new ProjectFileResponse(
                file.getId(),
                file.getProjectId(),
                file.getPath(),
                file.getName(),
                file.getContent(),
                file.getLanguage(),
                file.getUpdatedAt()
        );
    }
}
