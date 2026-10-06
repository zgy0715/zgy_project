package com.deepagent.scheduler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Task entity representing a schedulable unit in a DAG workflow.
 *
 * <p>Each task belongs to a project and can have dependencies on other tasks.
 * The DAG scheduler uses these dependencies to determine execution order.</p>
 *
 * <p>使用 {@code @Getter}/{@code @Setter} 而非 {@code @Data}：避免基于全部字段的
 * {@code equals}/{@code hashCode}（实体应用身份比较）与输出全部字段的 {@code toString()}。</p>
 */
@Entity
@Table(name = "tasks")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    /**
     * Task status enumeration representing the lifecycle of a task.
     */
    public enum Status {
        PENDING,
        RUNNING,
        SUCCESS,
        FAILED,
        SKIPPED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    /** 任务归属用户（V2 迁移新增，历史数据为 NULL）。 */
    @Column
    private Long ownerId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(length = 50)
    private String agentType;

    @Column(length = 5000)
    private String input;

    @Column(length = 10000)
    private String output;

    @Column(length = 2000)
    private String dependencies;

    @Column
    private Integer retryCount;

    @Column
    @Builder.Default
    private Integer maxRetries = 3;

    @Column
    private Integer priority;

    @Column
    private LocalDateTime startedAt;

    @Column
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
