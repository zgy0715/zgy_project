package com.deepagent.project.dto;

import java.time.LocalDateTime;

/**
 * 项目动态响应模型（project_activity 表，V2 迁移新增）。
 */
public record ActivityResponse(
        Long id,
        Long projectId,
        String type,
        String message,
        String actor,
        LocalDateTime createdAt
) {
}
