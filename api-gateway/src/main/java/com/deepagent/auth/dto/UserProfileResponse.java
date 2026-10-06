package com.deepagent.auth.dto;

import com.deepagent.auth.entity.User;

import java.time.LocalDateTime;

/**
 * 当前用户资料响应（不含任何凭据字段）。
 */
public record UserProfileResponse(
        Long id,
        String username,
        String email,
        String avatarUrl,
        User.Role role,
        LocalDateTime createdAt
) {
}
