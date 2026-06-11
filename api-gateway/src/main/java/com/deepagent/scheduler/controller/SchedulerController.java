package com.deepagent.scheduler.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.scheduler.dto.TaskRequest;
import com.deepagent.scheduler.dto.TaskResponse;
import com.deepagent.scheduler.service.DagScheduler;
import com.deepagent.scheduler.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
 * <p>Provides endpoints for creating tasks, triggering DAG execution,
 * and querying task status.</p>
 */
@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class SchedulerController {

    private final TaskService taskService;
    private final DagScheduler dagScheduler;

    /**
     * Creates a new task.
     *
     * @param request the task creation request
     * @return the created task
     */
    @PostMapping
    public ApiResponse<TaskResponse> createTask(@Valid @RequestBody TaskRequest request) {
        var response = taskService.createTask(request);
        return ApiResponse.success(response);
    }

    /**
     * Retrieves a task by ID.
     *
     * @param taskId the task ID
     * @return the task details
     */
    @GetMapping("/{taskId}")
    public ApiResponse<TaskResponse> getTask(@PathVariable Long taskId) {
        var response = taskService.getTask(taskId);
        return ApiResponse.success(response);
    }

    /**
     * Lists all tasks in a project.
     *
     * @param projectId the project ID
     * @return list of tasks
     */
    @GetMapping("/project/{projectId}")
    public ApiResponse<List<TaskResponse>> listTasksByProject(@PathVariable Long projectId) {
        var responses = taskService.listTasksByProject(projectId);
        return ApiResponse.success(responses);
    }

    /**
     * Triggers DAG execution for all tasks in a project.
     *
     * @param projectId the project ID
     * @return success response indicating execution has started
     */
    @PostMapping("/project/{projectId}/execute")
    public ApiResponse<Void> executeDag(@PathVariable Long projectId) {
        dagScheduler.executeDag(projectId);
        return ApiResponse.success(null, "DAG execution started for project: " + projectId);
    }
}
