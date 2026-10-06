package com.deepagent.project.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.response.PageResponse;
import com.deepagent.common.util.PrincipalUtils;
import com.deepagent.project.dto.ActivityResponse;
import com.deepagent.project.dto.ProjectFileCreateRequest;
import com.deepagent.project.dto.ProjectFileResponse;
import com.deepagent.project.dto.ProjectFileUpdateRequest;
import com.deepagent.project.dto.ProjectRequest;
import com.deepagent.project.dto.ProjectResponse;
import com.deepagent.project.service.ProjectActivityService;
import com.deepagent.project.service.ProjectFileService;
import com.deepagent.project.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for project management endpoints.
 *
 * <p>All endpoints require JWT authentication and are scoped to the authenticated
 * user's ownership. 归属校验在 controller（{@link PrincipalUtils}）与 service
 * （{@code findByIdAndOwnerId}）两层都做。</p>
 */
@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectFileService projectFileService;
    private final ProjectActivityService projectActivityService;

    /**
     * Creates a new project.
     */
    @PostMapping
    public ApiResponse<ProjectResponse> createProject(
            @Valid @RequestBody ProjectRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        var response = projectService.createProject(request, ownerId, userDetails.getUsername());
        return ApiResponse.success(response);
    }

    /**
     * Retrieves a project by ID (owner only).
     */
    @GetMapping("/{projectId}")
    public ApiResponse<ProjectResponse> getProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(projectService.getProject(projectId, ownerId));
    }

    /**
     * Lists projects owned by the authenticated user.
     */
    @GetMapping
    public ApiResponse<PageResponse<ProjectResponse>> listProjects(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        var response = projectService.listProjects(ownerId, page, size);
        return ApiResponse.success(response);
    }

    /**
     * Updates an existing project.
     */
    @PutMapping("/{projectId}")
    public ApiResponse<ProjectResponse> updateProject(
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        var response = projectService.updateProject(projectId, request, ownerId, userDetails.getUsername());
        return ApiResponse.success(response);
    }

    /**
     * Deletes a project (soft delete).
     */
    @DeleteMapping("/{projectId}")
    public ApiResponse<Void> deleteProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        projectService.deleteProject(projectId, ownerId, userDetails.getUsername());
        return ApiResponse.success(null);
    }

    /**
     * 列出项目文件（owner only）。
     */
    @GetMapping("/{projectId}/files")
    public ResponseEntity<ApiResponse<List<ProjectFileResponse>>> listFiles(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.success(projectFileService.listFiles(projectId, ownerId)));
    }

    /**
     * 创建项目文件（同名 path 覆盖内容）。
     */
    @PostMapping("/{projectId}/files")
    public ResponseEntity<ApiResponse<ProjectFileResponse>> createFile(
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectFileCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        var file = projectFileService.createFile(projectId, request, ownerId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(file, "File saved successfully"));
    }

    /**
     * 读取单个项目文件（owner only）。
     */
    @GetMapping("/{projectId}/files/{fileId}")
    public ResponseEntity<ApiResponse<ProjectFileResponse>> getFile(
            @PathVariable Long projectId,
            @PathVariable Long fileId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.success(projectFileService.getFile(projectId, fileId, ownerId)));
    }

    /**
     * 保存文件内容（owner only）。
     */
    @PutMapping("/{projectId}/files/{fileId}")
    public ResponseEntity<ApiResponse<ProjectFileResponse>> updateFile(
            @PathVariable Long projectId,
            @PathVariable Long fileId,
            @Valid @RequestBody ProjectFileUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        var file = projectFileService.updateFile(
                projectId, fileId, request.content(), ownerId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(file, "File saved successfully"));
    }

    /**
     * 项目动态流（owner only）。
     */
    @GetMapping("/{projectId}/activity")
    public ResponseEntity<ApiResponse<List<ActivityResponse>>> listActivity(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.success(
                projectActivityService.list(projectId, ownerId, limit)));
    }
}
