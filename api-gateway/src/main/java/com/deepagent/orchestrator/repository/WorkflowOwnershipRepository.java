package com.deepagent.orchestrator.repository;

import com.deepagent.orchestrator.entity.WorkflowOwnership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Workflow 归属仓储（配合 V2 迁移的 workflow_ownership 表）。
 */
@Repository
public interface WorkflowOwnershipRepository extends JpaRepository<WorkflowOwnership, String> {

    Optional<WorkflowOwnership> findByWorkflowId(String workflowId);

    Optional<WorkflowOwnership> findByWorkflowIdAndOwnerId(String workflowId, Long ownerId);

    List<WorkflowOwnership> findByOwnerId(Long ownerId);

    boolean existsByWorkflowIdAndOwnerId(String workflowId, Long ownerId);

    long countByOwnerId(Long ownerId);
}
