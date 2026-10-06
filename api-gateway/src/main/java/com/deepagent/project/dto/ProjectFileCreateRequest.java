package com.deepagent.project.dto;

/**
 * 创建项目文件请求（path 必填；同名 path 视为覆盖内容）。
 */
public record ProjectFileCreateRequest(
        @jakarta.validation.constraints.NotBlank(message = "File path is required")
        @jakarta.validation.constraints.Size(max = 500, message = "Path must be at most 500 characters")
        String path,
        @jakarta.validation.constraints.Size(max = 255, message = "Name must be at most 255 characters")
        String name,
        String content,
        @jakarta.validation.constraints.Size(max = 50, message = "Language must be at most 50 characters")
        String language
) {
}
