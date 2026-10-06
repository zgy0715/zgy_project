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
 * Workflow 归属记录（V2 迁移新增）。
 *
 * <p>agent-runtime 返回的 workflow 结构里没有归属字段，网关无法据此判断调用者是否为
 * 所有者，因此归属必须在网关侧持久化，否则 workflow 的读写/执行端点只能全部放行。</p>
 */
@Entity
@Table(name = "workflow_ownership")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowOwnership {

    @Id
    @Column(name = "workflow_id", nullable = false, length = 255)
    private String workflowId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
