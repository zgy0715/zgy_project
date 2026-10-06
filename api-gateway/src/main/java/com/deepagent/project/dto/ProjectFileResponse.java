package com.deepagent.project.dto;

import java.time.LocalDateTime;

/**
 * 项目文件响应模型（project_files 表，V2 迁移新增）。
 */
public record ProjectFileResponse(
        Long id,
        Long projectId,
        String path,
        String name,
        String content,
        String language,
        LocalDateTime updatedAt
) {
}
