package com.deepagent.scheduler.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
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
 *
 * <p>事务边界：本类不标注 {@code @Transactional}。任务状态变更全部委托给
 * {@link TaskService} 的短事务方法，既避免自调用导致注解失效，也避免在
 * 长达 10 分钟的 agent 调用期间持有数据库事务。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DagScheduler {

    private final DagParser dagParser;
    private final TaskService taskService;
    private final AgentOrchestrator agentOrchestrator;

    /**
     * Executes all tasks in a project according to DAG dependencies.
     *
     * <p>This method runs asynchronously ({@code @EnableAsync} on the application class,
     * {@code spring.threads.virtual.enabled=true} so the executor uses virtual threads).
     * It first validates the DAG, then executes tasks level by level with parallel
     * execution within each level.</p>
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
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new BusinessException("Task execution interrupted: " + e.getMessage());
                } catch (Exception e) {
                    throw new BusinessException("Task execution failed: " + rootMessage(e));
                }
            }
        }
    }

    /**
     * Executes a single task by invoking the agent orchestrator, retrying up to
     * {@code maxRetries} times.
     *
     * <p>状态流转：PENDING -> RUNNING -> SUCCESS，失败则重试，重试耗尽后 FAILED。</p>
     *
     * @param taskId the task ID to execute
     * @throws BusinessException if the task fails after all retries
     */
    public void executeTask(Long taskId) {
        var task = taskService.requireTask(taskId);
        int maxRetries = task.getMaxRetries() != null ? Math.max(task.getMaxRetries(), 0) : 0;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            taskService.markRunning(taskId);
            try {
                log.debug("Executing task: id={}, name={}, attempt={}/{}",
                        task.getId(), task.getName(), attempt + 1, maxRetries + 1);

                var result = agentOrchestrator.executeAgentTask(
                        task.getProjectId(), task.getId(), task.getAgentType(), task.getInput());

                taskService.markSuccess(taskId, result);
                log.info("Task completed successfully: id={}", task.getId());
                return;
            } catch (Exception e) {
                if (attempt < maxRetries) {
                    taskService.markRetry(taskId, attempt + 1);
                    log.warn("Task failed, retrying ({}/{}): id={}, error={}",
                            attempt + 1, maxRetries, taskId, rootMessage(e));
                } else {
                    taskService.markFailed(taskId, rootMessage(e));
                    log.error("Task failed after {} retries: id={}", attempt, taskId);
                    throw new BusinessException("Task " + taskId + " failed: " + rootMessage(e));
                }
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
    public void markRemainingTasksAsSkipped(Long projectId) {
        int skipped = taskService.markPendingTasksAsSkipped(projectId);
        log.info("Marked {} pending tasks as SKIPPED for project: {}", skipped, projectId);
    }

    /**
     * Unwraps nested exception messages so the persisted error is readable.
     */
    private String rootMessage(Throwable e) {
        var cause = e;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        var message = cause.getMessage() != null ? cause.getMessage() : cause.getClass().getSimpleName();
        return cause == e ? message : e.getMessage() + " -> " + message;
    }
}
