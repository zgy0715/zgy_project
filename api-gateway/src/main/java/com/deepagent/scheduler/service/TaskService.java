package com.deepagent.scheduler.service;

import com.deepagent.auth.entity.User;
import com.deepagent.auth.repository.UserRepository;
import com.deepagent.common.exception.BusinessException;
import com.deepagent.project.repository.ProjectRepository;
import com.deepagent.scheduler.dto.TaskRequest;
import com.deepagent.scheduler.dto.TaskResponse;
import com.deepagent.scheduler.entity.Task;
import com.deepagent.scheduler.repository.TaskRepository;
import com.deepagent.websocket.AgentWebSocketHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for task CRUD operations.
 *
 * <p>Manages the lifecycle of individual tasks including creation,
 * status updates, and retrieval. Task execution is handled by
 * {@link DagScheduler}.</p>
 *
 * <p>归属校验：任务级操作按 {@code tasks.owner_id} 校验；项目级操作
 * （创建、按项目列出）先校验项目归属，避免向他人项目注入任务。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    /** output 列长度上限（V1 定义为 VARCHAR(10000)）。 */
    private static final int MAX_OUTPUT_LENGTH = 10_000;

    /** 通知里失败原因的长度上限，避免把超长堆栈推给前端。 */
    private static final int MAX_NOTIFICATION_ERROR_LENGTH = 200;

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final AgentWebSocketHandler webSocketHandler;

    /**
     * Creates a new task inside a project owned by the given user.
     *
     * @param request the task creation request
     * @param ownerId the authenticated user's ID
     * @return the created task response
     */
    @Transactional
    public TaskResponse createTask(TaskRequest request, Long ownerId) {
        requireOwnedProject(request.projectId(), ownerId);

        var task = Task.builder()
                .name(request.name())
                .description(request.description())
                .projectId(request.projectId())
                .ownerId(ownerId)
                .agentType(request.agentType())
                .input(request.input())
                .dependencies(serializeDependencies(request.dependencies()))
                .maxRetries(request.maxRetries() != null ? request.maxRetries() : 3)
                .priority(request.priority())
                .status(Task.Status.PENDING)
                .build();

        var saved = taskRepository.save(task);
        log.info("Task created: id={}, name={}, project={}", saved.getId(), saved.getName(), saved.getProjectId());
        return toResponse(saved);
    }

    /**
     * Retrieves a task by ID (owner only).
     *
     * @param taskId  the task ID
     * @param ownerId the authenticated user's ID
     * @return the task response
     * @throws BusinessException if the task is not found or not owned by the user
     */
    @Transactional(readOnly = true)
    public TaskResponse getTask(Long taskId, Long ownerId) {
        return toResponse(findOwnedTaskOrThrow(taskId, ownerId));
    }

    /**
     * Lists all tasks in a project owned by the given user.
     *
     * @param projectId the project ID
     * @param ownerId   the authenticated user's ID
     * @return list of task responses
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> listTasksByProject(Long projectId, Long ownerId) {
        requireOwnedProject(projectId, ownerId);
        return taskRepository.findByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Updates an existing task (owner only, null 字段保持不变).
     *
     * @param taskId  the task ID
     * @param request the update request
     * @param ownerId the authenticated user's ID
     * @return the updated task response
     */
    @Transactional
    public TaskResponse updateTask(Long taskId, TaskRequest request, Long ownerId) {
        var task = findOwnedTaskOrThrow(taskId, ownerId);

        if (request.name() != null) {
            task.setName(request.name());
        }
        if (request.description() != null) {
            task.setDescription(request.description());
        }
        if (request.agentType() != null) {
            task.setAgentType(request.agentType());
        }
        if (request.input() != null) {
            task.setInput(request.input());
        }
        if (request.dependencies() != null) {
            task.setDependencies(serializeDependencies(request.dependencies()));
        }
        if (request.maxRetries() != null) {
            task.setMaxRetries(request.maxRetries());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }

        var saved = taskRepository.save(task);
        log.info("Task updated: id={}", saved.getId());
        return toResponse(saved);
    }

    /**
     * Deletes a task (owner only). 运行中的任务不允许删除。
     *
     * @param taskId  the task ID
     * @param ownerId the authenticated user's ID
     */
    @Transactional
    public void deleteTask(Long taskId, Long ownerId) {
        var task = findOwnedTaskOrThrow(taskId, ownerId);
        if (task.getStatus() == Task.Status.RUNNING) {
            throw new BusinessException("Cannot delete a running task: " + taskId);
        }
        taskRepository.delete(task);
        log.info("Task deleted: id={}", taskId);
    }

    /**
     * Loads a task entity for the scheduler (internal use, no ownership check).
     *
     * @param taskId the task ID
     * @return the task entity (detached once the transaction ends)
     * @throws BusinessException if not found
     */
    @Transactional(readOnly = true)
    public Task requireTask(Long taskId) {
        return findTaskOrThrow(taskId);
    }

    /** Marks a task as RUNNING in its own transaction. */
    @Transactional
    public void markRunning(Long taskId) {
        var task = findTaskOrThrow(taskId);
        task.setStatus(Task.Status.RUNNING);
        task.setStartedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    /** Marks a task as PENDING with an incremented retry counter (own transaction). */
    @Transactional
    public void markRetry(Long taskId, int retryCount) {
        var task = findTaskOrThrow(taskId);
        task.setRetryCount(retryCount);
        task.setStatus(Task.Status.PENDING);
        taskRepository.save(task);
    }

    /** Marks a task as SUCCESS and stores the agent output (own transaction). */
    @Transactional
    public void markSuccess(Long taskId, String output) {
        var task = findTaskOrThrow(taskId);
        task.setStatus(Task.Status.SUCCESS);
        task.setOutput(truncate(output));
        task.setCompletedAt(LocalDateTime.now());
        taskRepository.save(task);

        notifyOwner(task, AgentWebSocketHandler.TYPE_TASK_COMPLETED,
                "Task '" + task.getName() + "' completed successfully");
    }

    /** Marks a task as FAILED and stores the error message (own transaction). */
    @Transactional
    public void markFailed(Long taskId, String error) {
        var task = findTaskOrThrow(taskId);
        task.setStatus(Task.Status.FAILED);
        task.setCompletedAt(LocalDateTime.now());
        task.setOutput(truncate("Error: " + error));
        taskRepository.save(task);

        notifyOwner(task, AgentWebSocketHandler.TYPE_TASK_FAILED,
                "Task '" + task.getName() + "' failed: " + truncateError(error));
    }

    /** Marks every PENDING task of a project as SKIPPED (own transaction). */
    @Transactional
    public int markPendingTasksAsSkipped(Long projectId) {
        var pendingTasks = taskRepository.findByProjectIdAndStatus(projectId, Task.Status.PENDING);
        for (var task : pendingTasks) {
            task.setStatus(Task.Status.SKIPPED);
            taskRepository.save(task);
        }
        log.info("Marked {} pending tasks as SKIPPED for project: {}", pendingTasks.size(), projectId);
        return pendingTasks.size();
    }

    /**
     * Verifies that a project exists and belongs to the user.
     *
     * @throws BusinessException if not found or not owned by the user
     */
    @Transactional(readOnly = true)
    public void requireOwnedProject(Long projectId, Long ownerId) {
        if (projectId == null || ownerId == null
                || projectRepository.findByIdAndOwnerId(projectId, ownerId).isEmpty()) {
            throw new BusinessException("Project not found: " + projectId);
        }
    }

    /**
     * Finds a task by ID or throws a BusinessException.
     */
    private Task findTaskOrThrow(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("Task not found: " + taskId));
    }

    /**
     * Finds a task by ID scoped to its owner (fail-closed).
     */
    private Task findOwnedTaskOrThrow(Long taskId, Long ownerId) {
        if (ownerId == null) {
            throw new BusinessException("Authentication required");
        }
        return taskRepository.findByIdAndOwnerId(taskId, ownerId)
                .orElseThrow(() -> new BusinessException("Task not found: " + taskId));
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_OUTPUT_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_OUTPUT_LENGTH);
    }

    private String truncateError(String error) {
        if (error == null) {
            return "unknown error";
        }
        if (error.length() <= MAX_NOTIFICATION_ERROR_LENGTH) {
            return error;
        }
        return error.substring(0, MAX_NOTIFICATION_ERROR_LENGTH) + "...";
    }

    /**
     * 向任务所有者推送一条终端状态通知（TASK_COMPLETED / TASK_FAILED）。
     *
     * <p>只用于终态事件，绝不在 agent 输出流上调用。通知失败（用户不存在、
     * STOMP 中断等）只记 WARN，不能影响任务状态落库这一主流程。</p>
     */
    private void notifyOwner(Task task, String type, String message) {
        var ownerId = task.getOwnerId();
        if (ownerId == null) {
            return;
        }
        try {
            userRepository.findById(ownerId)
                    .map(User::getUsername)
                    .ifPresent(username -> webSocketHandler.notifyUser(username, type, message));
        } catch (Exception e) {
            log.warn("Failed to send {} notification for task {}: {}", type, task.getId(), e.getMessage());
        }
    }

    /**
     * Serializes a list of dependency IDs to a JSON string.
     */
    private String serializeDependencies(List<Long> dependencies) {
        if (dependencies == null || dependencies.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(dependencies);
        } catch (JsonProcessingException e) {
            throw new BusinessException("Failed to serialize dependencies: " + e.getMessage());
        }
    }

    /**
     * Deserializes a JSON string to a list of dependency IDs.
     */
    private List<Long> deserializeDependencies(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize dependencies: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Converts a Task entity to a TaskResponse DTO.
     */
    private TaskResponse toResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getName(),
                task.getDescription(),
                task.getProjectId(),
                task.getStatus(),
                task.getAgentType(),
                task.getInput(),
                task.getOutput(),
                deserializeDependencies(task.getDependencies()),
                task.getRetryCount(),
                task.getMaxRetries(),
                task.getPriority(),
                task.getStartedAt(),
                task.getCompletedAt(),
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }
}
