package com.deepagent.project.repository;

import com.deepagent.project.entity.ProjectActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectActivityRepository extends JpaRepository<ProjectActivity, Long> {

    /**
     * 取某项目最近的活动记录（调用方通过 Pageable 限制条数）。
     */
    List<ProjectActivity> findByProjectIdOrderByCreatedAtDesc(Long projectId, Pageable pageable);

    long countByProjectId(Long projectId);
}
