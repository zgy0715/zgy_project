package com.deepagent.scheduler.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.scheduler.dto.TaskRequest;
import com.deepagent.scheduler.dto.TaskResponse;
import com.deepagent.scheduler.entity.Task;
import com.deepagent.scheduler.repository.TaskRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service for task CRUD operations.
 *
 * <p>Manages the lifecycle of individual tasks including creation,
 * status updates, and retrieval. Task execution is handled by
 * {@link DagScheduler}.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;

    /**
     * Creates a new task.
     *
     * @param request the task creation request
     * @return the created task response
     */
    @Transactional
    public TaskResponse createTask(TaskRequest request) {
        var task = Task.builder()
                .name(request.name())
                .description(request.description())
                .projectId(request.projectId())
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
     * Retrieves a task by ID.
     *
     * @param taskId the task ID
     * @return the task response
     * @throws BusinessException if the task is not found
     */
    @Transactional(readOnly = true)
    public TaskResponse getTask(Long taskId) {
        var task = findTaskOrThrow(taskId);
        return toResponse(task);
    }

    /**
     * Lists all tasks in a project.
     *
     * @param projectId the project ID
     * @return list of task responses
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> listTasksByProject(Long projectId) {
        return taskRepository.findByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Updates a task's status.
     *
     * @param taskId the task ID
     * @param status the new status
     * @return the updated task response
     * @throws BusinessException if the task is not found
     */
    @Transactional
    public TaskResponse updateTaskStatus(Long taskId, Task.Status status) {
        var task = findTaskOrThrow(taskId);
        task.setStatus(status);

        if (status == Task.Status.RUNNING) {
            task.setStartedAt(java.time.LocalDateTime.now());
        } else if (status == Task.Status.SUCCESS || status == Task.Status.FAILED) {
            task.setCompletedAt(java.time.LocalDateTime.now());
        }

        var saved = taskRepository.save(task);
        log.info("Task status updated: id={}, status={}", saved.getId(), status);
        return toResponse(saved);
    }

    /**
     * Finds a task by ID or throws a BusinessException.
     *
     * @param taskId the task ID
     * @return the task entity
     * @throws BusinessException if not found
     */
    private Task findTaskOrThrow(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("Task not found: " + taskId));
    }

    /**
     * Serializes a list of dependency IDs to a JSON string.
     *
     * @param dependencies the list of dependency IDs
     * @return the JSON string representation
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
     *
     * @param json the JSON string
     * @return the list of dependency IDs
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
     *
     * @param task the task entity
     * @return the task response DTO
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
