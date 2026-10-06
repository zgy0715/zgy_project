package com.deepagent.scheduler.repository;

import com.deepagent.scheduler.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

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
     * 按 (任务 ID, 归属用户) 查询，用于越权校验。
     */
    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    /**
     * 按项目与归属用户查询任务。
     */
    List<Task> findByProjectIdAndOwnerId(Long projectId, Long ownerId);

    /**
     * 判断项目是否属于该用户（项目级越权校验）。
     */
    boolean existsByProjectIdAndOwnerId(Long projectId, Long ownerId);
}
