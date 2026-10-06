package com.deepagent.orchestrator.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Agent 归属关系（agent_id -> owner_id）。
 *
 * 原先 AgentController 用内存 ConcurrentHashMap 记录归属，存在两个问题：
 * 1) 进程重启后归属全部丢失，导致 fail-open（无记录即放行）；
 * 2) 多实例部署时各实例视图不一致。
 * 因此改为持久化到 agent_ownership 表，并在查不到记录时 fail-closed。
 */
@Entity
@Table(name = "agent_ownership")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentOwnership {

    /** agent-runtime 侧返回的 agent ID，由业务赋值，非自增。 */
    @Id
    @Column(nullable = false, length = 255)
    private String agentId;

    @Column(nullable = false)
    private Long ownerId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
