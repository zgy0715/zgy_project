package com.deepagent.orchestrator.repository;

import com.deepagent.orchestrator.entity.AgentOwnership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentOwnershipRepository extends JpaRepository<AgentOwnership, String> {

    Optional<AgentOwnership> findByAgentId(String agentId);

    Optional<AgentOwnership> findByAgentIdAndOwnerId(String agentId, Long ownerId);

    List<AgentOwnership> findByOwnerId(Long ownerId);

    boolean existsByAgentIdAndOwnerId(String agentId, Long ownerId);

    long countByOwnerId(Long ownerId);
}
