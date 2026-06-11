package com.deepagent.scheduler.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import com.deepagent.scheduler.entity.Task;
import com.deepagent.scheduler.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * DAG scheduler that executes tasks in topological order with parallel execution.
 *
 * <p>Uses the {@link DagParser} to determine execution levels, then executes
 * tasks within each level concurrently using virtual threads. Tasks at the
 * same level have no dependencies on each other and can safely run in parallel.</p>
 *
 * <p>Execution flow:</p>
 * <ol>
 *   <li>Validate the DAG structure</li>
 *   <li>Compute execution levels via topological sort</li>
 *   <li>For each level, submit all tasks to a virtual thread executor</li>
 *   <li>Wait for all tasks in a level to complete before proceeding</li>
 *   <li>If any task fails, mark remaining tasks as SKIPPED</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DagScheduler {

    private final DagParser dagParser;
    private final TaskRepository taskRepository;
    private final AgentOrchestrator agentOrchestrator;

    /**
     * Executes all tasks in a project according to DAG dependencies.
     *
     * <p>This method runs asynchronously using virtual threads. It first validates
     * the DAG, then executes tasks level by level with parallel execution
     * within each level.</p>
     *
     * @param projectId the project ID whose tasks to execute
     */
    @Async
    public void executeDag(Long projectId) {
        log.info("Starting DAG execution for project: {}", projectId);

        try {
            // Validate the DAG structure
            dagParser.validateDag(projectId);

            // Get execution levels for parallel scheduling
            var levels = dagParser.getExecutionLevels(projectId);
            log.info("DAG has {} execution levels for project: {}", levels.size(), projectId);

            // Execute level by level
            for (int i = 0; i < levels.size(); i++) {
                var level = levels.get(i);
                log.info("Executing level {}/{} with {} tasks", i + 1, levels.size(), level.size());

                executeLevel(projectId, level);

                log.info("Level {}/{} completed successfully", i + 1, levels.size());
            }

            log.info("DAG execution completed for project: {}", projectId);
        } catch (BusinessException e) {
            log.error("DAG execution failed for project {}: {}", projectId, e.getMessage());
            markRemainingTasksAsSkipped(projectId);
        } catch (Exception e) {
            log.error("Unexpected error during DAG execution for project {}: {}",
                    projectId, e.getMessage(), e);
            markRemainingTasksAsSkipped(projectId);
        }
    }

    /**
     * Executes all tasks in a single level concurrently using virtual threads.
     *
     * <p>All tasks in a level are submitted to a virtual thread executor.
     * If any task fails, the method throws a BusinessException to halt
     * further level execution.</p>
     *
     * @param projectId the project ID
     * @param taskIds   the task IDs at this execution level
     * @throws BusinessException if any task in the level fails
     */
    private void executeLevel(Long projectId, List<Long> taskIds) {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var futures = taskIds.stream()
                    .map(taskId -> executor.submit(() -> executeTask(taskId)))
                    .toList();

            // Wait for all tasks in this level to complete
            for (var future : futures) {
                try {
                    future.get();
                } catch (Exception e) {
                    throw new BusinessException("Task execution failed: " + e.getMessage());
                }
            }
        }
    }

    /**
     * Executes a single task by invoking the agent orchestrator.
     *
     * <p>Updates the task status through its lifecycle:
     * PENDING -> RUNNING -> SUCCESS/FAILED</p>
     *
     * @param taskId the task ID to execute
     */
    @Transactional
    public void executeTask(Long taskId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new BusinessException("Task not found: " + taskId));

        try {
            // Mark as running
            task.setStatus(Task.Status.RUNNING);
            task.setStartedAt(LocalDateTime.now());
            taskRepository.save(task);

            log.debug("Executing task: id={}, name={}", task.getId(), task.getName());

            // Invoke the agent orchestrator
            var result = agentOrchestrator.executeAgentTask(
                    task.getProjectId(), task.getId(), task.getAgentType(), task.getInput());

            // Mark as success
            task.setStatus(Task.Status.SUCCESS);
            task.setOutput(result);
            task.setCompletedAt(LocalDateTime.now());
            taskRepository.save(task);

            log.info("Task completed successfully: id={}", task.getId());
        } catch (Exception e) {
            // Handle retry logic
            var retryCount = task.getRetryCount() != null ? task.getRetryCount() : 0;
            if (retryCount < task.getMaxRetries()) {
                task.setRetryCount(retryCount + 1);
                task.setStatus(Task.Status.PENDING);
                taskRepository.save(task);
                log.warn("Task failed, will retry ({}/{}): id={}, error={}",
                        retryCount + 1, task.getMaxRetries(), task.getId(), e.getMessage());
            } else {
                task.setStatus(Task.Status.FAILED);
                task.setCompletedAt(LocalDateTime.now());
                task.setOutput("Error: " + e.getMessage());
                taskRepository.save(task);
                log.error("Task failed after {} retries: id={}", task.getMaxRetries(), task.getId());
                throw new BusinessException("Task " + taskId + " failed: " + e.getMessage());
            }
        }
    }

    /**
     * Marks all remaining PENDING tasks in a project as SKIPPED.
     *
     * <p>Called when DAG execution is aborted due to a task failure.</p>
     *
     * @param projectId the project ID
     */
    @Transactional
    public void markRemainingTasksAsSkipped(Long projectId) {
        var pendingTasks = taskRepository.findByProjectIdAndStatus(projectId, Task.Status.PENDING);
        for (var task : pendingTasks) {
            task.setStatus(Task.Status.SKIPPED);
            taskRepository.save(task);
        }
        log.info("Marked {} pending tasks as SKIPPED for project: {}",
                pendingTasks.size(), projectId);
    }
}
