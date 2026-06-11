package com.deepagent.auth.dto;

import com.deepagent.auth.entity.User;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Authentication response DTO containing JWT tokens and user info.
 *
 * @param accessToken  the JWT access token
 * @param refreshToken the JWT refresh token for token renewal
 * @param tokenType    the token type (always "Bearer")
 * @param expiresIn    the access token expiration time in seconds
 * @param username     the authenticated user's username
 * @param email        the authenticated user's email
 * @param role         the authenticated user's role
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(

        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        String username,
        String email,
        User.Role role

) {

    /**
     * Creates a builder-style factory method for convenience.
     *
     * @param accessToken  the JWT access token
     * @param refreshToken the JWT refresh token
     * @param expiresIn    expiration time in seconds
     * @param username     the username
     * @param email        the email
     * @param role         the user role
     * @return a new AuthResponse instance
     */
    public static AuthResponse of(String accessToken, String refreshToken,
                                  long expiresIn, String username,
                                  String email, User.Role role) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", expiresIn,
                username, email, role);
    }
}
