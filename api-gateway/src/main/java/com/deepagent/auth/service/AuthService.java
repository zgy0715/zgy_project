package com.deepagent.auth.service;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.ChangePasswordRequest;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
import com.deepagent.auth.dto.UpdateProfileRequest;
import com.deepagent.auth.dto.UserProfileResponse;
import com.deepagent.auth.entity.User;

/**
 * Authentication service interface for user authentication operations.
 *
 * <p>Provides methods for user registration, login, and token refresh.
 * All operations return an {@link AuthResponse} containing JWT tokens.</p>
 */
public interface AuthService {

    /**
     * Registers a new user account.
     *
     * @param request the registration request containing username, email, and password
     * @return the authentication response with JWT tokens
     * @throws com.deepagent.common.exception.BusinessException if username or email already exists
     */
    AuthResponse register(RegisterRequest request);

    /**
     * Authenticates a user and returns JWT tokens.
     *
     * @param request the login request containing username and password
     * @return the authentication response with JWT tokens
     * @throws com.deepagent.common.exception.BusinessException if credentials are invalid
     */
    AuthResponse login(LoginRequest request);

    /**
     * Refreshes the access token using a valid refresh token.
     *
     * @param refreshToken the refresh token string
     * @return a new authentication response with fresh JWT tokens
     * @throws com.deepagent.common.exception.BusinessException if the refresh token is invalid or expired
     */
    AuthResponse refreshToken(String refreshToken);

    /**
     * Finds a user by username.
     *
     * @param username the username to search for
     * @return the User entity, or null if not found
     */
    User findByUsername(String username);

    /**
     * 获取当前用户资料。
     *
     * @param userId 当前用户 ID
     * @return 用户资料
     */
    UserProfileResponse getProfile(Long userId);

    /**
     * 更新当前用户资料（用户名/邮箱/头像）。
     *
     * @param userId  当前用户 ID
     * @param request 更新请求，所有字段可选
     * @return 更新后的用户资料
     * @throws com.deepagent.common.exception.BusinessException 用户名或邮箱已被占用
     */
    UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request);

    /**
     * 修改当前用户密码。
     *
     * @param userId  当前用户 ID
     * @param request 包含旧密码与新密码
     * @throws com.deepagent.common.exception.UnauthorizedException 旧密码不正确
     */
    void changePassword(Long userId, ChangePasswordRequest request);
}
