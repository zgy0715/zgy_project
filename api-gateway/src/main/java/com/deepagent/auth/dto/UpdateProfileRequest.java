package com.deepagent.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * 更新当前用户资料请求。所有字段均可选；空字符串按“不修改”处理。
 */
public record UpdateProfileRequest(
        @Size(max = 100, message = "Username must be at most 100 characters")
        String username,

        @Email(message = "Invalid email format")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @Size(max = 500, message = "Avatar url must be at most 500 characters")
        String avatarUrl
) {
}
