package com.deepagent.auth.controller;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
import com.deepagent.auth.service.AuthService;
import com.deepagent.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for authentication endpoints.
 *
 * <p>Provides public endpoints for user registration, login, and token refresh.
 * All endpoints are prefixed with {@code /api/v1/auth} and do not require
 * prior authentication.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    private static final String REFRESH_TOKEN_HEADER = "X-Refresh-Token";

    /**
     * Registers a new user account.
     *
     * @param request the registration request with username, email, and password
     * @return API response containing JWT tokens and user info
     */
    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Registration attempt for username: {}", request.username());
        var authResponse = authService.register(request);
        return ApiResponse.success(authResponse);
    }

    /**
     * Authenticates a user and returns JWT tokens.
     *
     * @param request the login request with username and password
     * @return API response containing JWT tokens and user info
     */
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("Login attempt for username: {}", request.username());
        var authResponse = authService.login(request);
        return ApiResponse.success(authResponse);
    }

    /**
     * Refreshes the access token using a valid refresh token.
     *
     * @param refreshToken the refresh token from the request header
     * @return API response containing new JWT tokens
     */
    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refreshToken(
            @RequestHeader(REFRESH_TOKEN_HEADER) String refreshToken) {
        log.debug("Token refresh request received");
        var authResponse = authService.refreshToken(refreshToken);
        return ApiResponse.success(authResponse);
    }
}
