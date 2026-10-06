package com.deepagent.project.repository;

import com.deepagent.project.entity.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {

    List<ProjectFile> findByProjectIdOrderByPathAsc(Long projectId);

    /**
     * 按 (文件 ID, 项目 ID) 查询：文件必须属于该项目，避免跨项目越权读取。
     */
    Optional<ProjectFile> findByIdAndProjectId(Long id, Long projectId);

    Optional<ProjectFile> findByProjectIdAndPath(Long projectId, String path);

    boolean existsByProjectIdAndPath(Long projectId, String path);

    long countByProjectId(Long projectId);

    void deleteByProjectId(Long projectId);
}
