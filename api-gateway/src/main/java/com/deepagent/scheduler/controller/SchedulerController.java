package com.deepagent.scheduler.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.scheduler.dto.TaskRequest;
import com.deepagent.scheduler.dto.TaskResponse;
import com.deepagent.scheduler.service.DagScheduler;
import com.deepagent.scheduler.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for task scheduling endpoints.
 *
 * <p>All endpoints require JWT authentication.</p>
 */
@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class SchedulerController {

    private final TaskService taskService;
    private final DagScheduler dagScheduler;

    @PostMapping
    public ApiResponse<TaskResponse> createTask(
            @Valid @RequestBody TaskRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var response = taskService.createTask(request);
        return ApiResponse.success(response);
    }

    @GetMapping("/{taskId}")
    public ApiResponse<TaskResponse> getTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var response = taskService.getTask(taskId);
        return ApiResponse.success(response);
    }

    @GetMapping("/project/{projectId}")
    public ApiResponse<List<TaskResponse>> listTasksByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var responses = taskService.listTasksByProject(projectId);
        return ApiResponse.success(responses);
    }

    @PostMapping("/project/{projectId}/execute")
    public ApiResponse<Void> executeDag(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        dagScheduler.executeDag(projectId);
        return ApiResponse.success(null, "DAG execution started for project: " + projectId);
    }
}
