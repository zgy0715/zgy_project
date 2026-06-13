package com.deepagent.auth.service;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
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
}
