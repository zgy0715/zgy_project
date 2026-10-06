package com.deepagent.auth.controller;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.ChangePasswordRequest;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
import com.deepagent.auth.dto.UpdateProfileRequest;
import com.deepagent.auth.dto.UserProfileResponse;
import com.deepagent.auth.jwt.JwtTokenProvider;
import com.deepagent.auth.service.AuthService;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.util.PrincipalUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * REST controller for authentication endpoints.
 *
 * <p>Provides public endpoints for user registration, login, and token refresh,
 * plus authenticated endpoints for the current user's profile and password.
 * All endpoints are prefixed with {@code /api/v1/auth}.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String REFRESH_TOKEN_HEADER = "X-Refresh-Token";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String TOKEN_BLACKLIST_PREFIX = "jwt:blacklist:";

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

    /**
     * Logs out the current user by blacklisting their JWT token.
     *
     * <p>Extracts the access token from the Authorization header and adds
     * its JTI to the Redis blacklist with a TTL matching the token's
     * remaining validity period. This ensures the token cannot be reused
     * even if it has not yet expired.</p>
     *
     * @param authHeader the Authorization header containing the Bearer token
     * @return success response
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            @RequestHeader(AUTHORIZATION_HEADER) String authHeader,
            @RequestHeader(value = REFRESH_TOKEN_HEADER, required = false) String refreshTokenHeader) {
        var token = extractTokenFromHeader(authHeader);
        if (token != null && jwtTokenProvider.validateAccessToken(token)) {
            var tokenId = jwtTokenProvider.getTokenId(token);
            var expirationSeconds = jwtTokenProvider.getAccessTokenExpirationSeconds();
            var key = TOKEN_BLACKLIST_PREFIX + tokenId;
            redisTemplate.opsForValue().set(key, "revoked", expirationSeconds, TimeUnit.SECONDS);
            log.info("Token blacklisted successfully: jti={}", tokenId);
        } else {
            log.warn("Logout attempted with invalid or missing token");
        }

        // Also blacklist refresh token if provided
        if (refreshTokenHeader != null && !refreshTokenHeader.isBlank()) {
            try {
                if (jwtTokenProvider.validateRefreshToken(refreshTokenHeader)) {
                    var refreshJti = jwtTokenProvider.getTokenId(refreshTokenHeader);
                    var refreshExpirationSeconds = jwtTokenProvider.getRefreshTokenExpirationSeconds();
                    redisTemplate.opsForValue().set(
                        TOKEN_BLACKLIST_PREFIX + refreshJti, "revoked",
                        refreshExpirationSeconds, TimeUnit.SECONDS);
                    log.info("Refresh token blacklisted: jti={}", refreshJti);
                }
            } catch (Exception e) {
                log.warn("Failed to blacklist refresh token: {}", e.getMessage());
            }
        }

        return ApiResponse.success(null, "Logged out successfully");
    }

    /**
     * Returns the current authenticated user's information.
     *
     * @param authHeader the Authorization header containing the Bearer token
     * @return API response containing user information
     */
    @GetMapping("/me")
    public ApiResponse<AuthResponse> getCurrentUser(
            @RequestHeader(AUTHORIZATION_HEADER) String authHeader) {
        var token = extractTokenFromHeader(authHeader);
        if (token != null && jwtTokenProvider.validateAccessToken(token)) {
            var username = jwtTokenProvider.getUsernameFromToken(token);
            var user = authService.findByUsername(username);
            if (user != null) {
                var authResponse = new AuthResponse(
                    null, null, "Bearer", 0,
                    user.getUsername(), user.getEmail(), user.getRole()
                );
                return ApiResponse.success(authResponse);
            }
        }
        return ApiResponse.error("Unauthorized", "Invalid or expired token");
    }

    /**
     * Returns the current authenticated user's profile.
     *
     * @param userDetails the authenticated principal
     * @return API response containing the user profile
     */
    @GetMapping("/profile")
    public ApiResponse<UserProfileResponse> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        return ApiResponse.success(authService.getProfile(userId));
    }

    /**
     * Updates the current authenticated user's profile.
     *
     * @param userDetails the authenticated principal
     * @param request     the profile update request (all fields optional)
     * @return API response containing the updated profile
     */
    @PutMapping("/profile")
    public ApiResponse<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        var profile = authService.updateProfile(userId, request);
        return ApiResponse.success(profile, "Profile updated successfully");
    }

    /**
     * Changes the current authenticated user's password.
     *
     * @param userDetails the authenticated principal
     * @param request     the old and new password
     * @return success response
     */
    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        authService.changePassword(userId, request);
        return ApiResponse.success(null, "Password changed successfully");
    }

    /**
     * Extracts the JWT token from the Authorization header.
     *
     * @param authHeader the Authorization header value
     * @return the token string, or null if not present or malformed
     */
    private String extractTokenFromHeader(String authHeader) {
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            return authHeader.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
