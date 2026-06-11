package com.deepagent.project.repository;

import com.deepagent.project.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository interface for Project entity persistence operations.
 */
@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    /**
     * Finds all projects owned by a specific user, paginated.
     *
     * @param ownerId  the owner's user ID
     * @param pageable pagination information
     * @return a page of projects
     */
    Page<Project> findByOwnerId(Long ownerId, Pageable pageable);

    /**
     * Finds all active projects owned by a specific user.
     *
     * @param ownerId the owner's user ID
     * @param status  the project status
     * @return list of matching projects
     */
    List<Project> findByOwnerIdAndStatus(Long ownerId, Project.Status status);
}
