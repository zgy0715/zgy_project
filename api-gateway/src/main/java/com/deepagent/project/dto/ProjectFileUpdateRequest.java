package com.deepagent.project.dto;

/**
 * 更新项目文件内容的请求体（content 为 null 表示内容不变）。
 */
public record ProjectFileUpdateRequest(
        @jakarta.validation.constraints.Size(max = 2_000_000, message = "File content is too large")
        String content
) {
}
