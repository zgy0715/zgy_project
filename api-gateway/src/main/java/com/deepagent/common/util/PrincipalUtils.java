package com.deepagent.common.util;

import com.deepagent.auth.entity.User;
import com.deepagent.common.exception.UnauthorizedException;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 从 Spring Security 上下文中解析当前用户。
 *
 * <p>说明：各 Controller 原先各自复制了一份 {@code extractUserId}，并且在遇到
 * 非 {@link User} 类型的 principal 时抛出 {@link IllegalStateException}（HTTP 500）。
 * 这里统一改为抛出 {@link UnauthorizedException}（HTTP 401），既避免 500，也避免
 * 因为“拿不到用户 ID”而静默放行。</p>
 */
public final class PrincipalUtils {

    private PrincipalUtils() {
    }

    /**
     * 获取当前登录用户 ID，永不为 null。
     *
     * @param userDetails 由 {@code @AuthenticationPrincipal} 注入的 principal
     * @return 用户 ID
     * @throws UnauthorizedException 未认证或 principal 类型不符合预期
     */
    public static Long requireUserId(UserDetails userDetails) {
        if (userDetails == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (userDetails instanceof User user && user.getId() != null) {
            return user.getId();
        }
        throw new UnauthorizedException("Unexpected principal type: " + userDetails.getClass().getName());
    }

    /**
     * 获取当前登录用户名，未认证时返回 null。
     */
    public static String username(UserDetails userDetails) {
        return userDetails == null ? null : userDetails.getUsername();
    }
}
