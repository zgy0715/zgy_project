package com.deepagent.scheduler.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.util.PrincipalUtils;
import com.deepagent.scheduler.dto.TaskRequest;
import com.deepagent.scheduler.dto.TaskResponse;
import com.deepagent.scheduler.service.DagScheduler;
import com.deepagent.scheduler.service.TaskService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for task scheduling endpoints.
 *
 * <p>All endpoints require JWT authentication. 任务级操作按任务归属校验，
 * 项目级操作（创建任务 / 按项目列出 / 触发 DAG）先校验项目归属，
 * 避免向他人项目注入任务或触发他人项目的执行。</p>
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
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(taskService.createTask(request, ownerId));
    }

    @GetMapping("/{taskId}")
    public ApiResponse<TaskResponse> getTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(taskService.getTask(taskId, ownerId));
    }

    /**
     * 更新任务（归属校验，null 字段保持不变）。
     */
    @PutMapping("/{taskId}")
    public ApiResponse<TaskResponse> updateTask(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(taskService.updateTask(taskId, request, ownerId));
    }

    /**
     * 删除任务（归属校验，运行中的任务不可删除）。
     */
    @DeleteMapping("/{taskId}")
    public ApiResponse<Void> deleteTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        taskService.deleteTask(taskId, ownerId);
        return ApiResponse.success(null, "Task deleted successfully");
    }

    @GetMapping("/project/{projectId}")
    public ApiResponse<List<TaskResponse>> listTasksByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(taskService.listTasksByProject(projectId, ownerId));
    }

    @PostMapping("/project/{projectId}/execute")
    public ApiResponse<Void> executeDag(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        taskService.requireOwnedProject(projectId, ownerId);
        dagScheduler.executeDag(projectId);
        return ApiResponse.success(null, "DAG execution started for project: " + projectId);
    }
}
