package com.deepagent.scheduler.repository;

import com.deepagent.scheduler.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository interface for Task entity persistence operations.
 */
@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Finds all tasks belonging to a specific project.
     *
     * @param projectId the project ID
     * @return list of tasks in the project
     */
    List<Task> findByProjectId(Long projectId);

    /**
     * Finds all tasks in a project with a specific status.
     *
     * @param projectId the project ID
     * @param status    the task status
     * @return list of matching tasks
     */
    List<Task> findByProjectIdAndStatus(Long projectId, Task.Status status);

    /**
     * Finds all pending tasks that have no unresolved dependencies.
     *
     * @param projectId the project ID
     * @return list of tasks ready for execution
     */
    @Query("SELECT t FROM Task t WHERE t.projectId = :projectId AND t.status = 'PENDING'")
    List<Task> findPendingTasksByProjectId(@Param("projectId") Long projectId);
}
