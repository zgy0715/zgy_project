package com.deepagent.project.controller;

import com.deepagent.auth.entity.User;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.response.PageResponse;
import com.deepagent.project.dto.ProjectRequest;
import com.deepagent.project.dto.ProjectResponse;
import com.deepagent.project.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

/**
 * REST controller for project management endpoints.
 *
 * <p>All endpoints require JWT authentication. Project operations are
 * scoped to the authenticated user's ownership.</p>
 */
@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    /**
     * Creates a new project.
     *
     * @param request    the project creation request
     * @param userDetails the authenticated user
     * @return the created project
     */
    @PostMapping
    public ApiResponse<ProjectResponse> createProject(
            @Valid @RequestBody ProjectRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = extractUserId(userDetails);
        var response = projectService.createProject(request, ownerId);
        return ApiResponse.success(response);
    }

    /**
     * Retrieves a project by ID.
     *
     * @param projectId the project ID
     * @return the project details
     */
    @GetMapping("/{projectId}")
    public ApiResponse<ProjectResponse> getProject(@PathVariable Long projectId) {
        var response = projectService.getProject(projectId);
        return ApiResponse.success(response);
    }

    /**
     * Lists projects owned by the authenticated user.
     *
     * @param userDetails the authenticated user
     * @param page        the page number (0-based)
     * @param size        the page size
     * @return paginated list of projects
     */
    @GetMapping
    public ApiResponse<PageResponse<ProjectResponse>> listProjects(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var ownerId = extractUserId(userDetails);
        var response = projectService.listProjects(ownerId, page, size);
        return ApiResponse.success(response);
    }

    /**
     * Updates an existing project.
     *
     * @param projectId   the project ID
     * @param request     the update request
     * @param userDetails the authenticated user
     * @return the updated project
     */
    @PutMapping("/{projectId}")
    public ApiResponse<ProjectResponse> updateProject(
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = extractUserId(userDetails);
        var response = projectService.updateProject(projectId, request, ownerId);
        return ApiResponse.success(response);
    }

    /**
     * Deletes a project (soft delete).
     *
     * @param projectId   the project ID
     * @param userDetails the authenticated user
     * @return success response
     */
    @DeleteMapping("/{projectId}")
    public ApiResponse<Void> deleteProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = extractUserId(userDetails);
        projectService.deleteProject(projectId, ownerId);
        return ApiResponse.success(null);
    }

    /**
     * Extracts the user ID from the authenticated principal.
     *
     * <p>Casts the Spring Security principal to our custom {@link User}
     * entity which implements {@link UserDetails}, then returns the
     * database user ID.</p>
     *
     * @param userDetails the authenticated user details
     * @return the user ID
     */
    private Long extractUserId(UserDetails userDetails) {
        if (userDetails instanceof User user) {
            return user.getId();
        }
        throw new IllegalStateException("Unexpected principal type: " + userDetails.getClass().getName());
    }
}
