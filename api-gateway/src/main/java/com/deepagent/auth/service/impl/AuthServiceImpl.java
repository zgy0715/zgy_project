package com.deepagent.auth.service.impl;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
import com.deepagent.auth.entity.User;
import com.deepagent.auth.jwt.JwtTokenProvider;
import com.deepagent.auth.repository.UserRepository;
import com.deepagent.auth.service.AuthService;
import com.deepagent.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation of the authentication service.
 *
 * <p>Handles user registration, login, and token refresh operations.
 * Uses BCrypt for password hashing and JWT for stateless authentication.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * {@inheritDoc}
     *
     * <p>Validates that the username and email are unique, encodes the password,
     * persists the new user, and returns JWT tokens.</p>
     */
    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new BusinessException("Username already exists: " + request.username());
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already exists: " + request.email());
        }

        var user = User.builder()
                .username(request.username())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(User.Role.USER)
                .enabled(true)
                .build();

        var savedUser = userRepository.save(user);
        log.info("User registered successfully: {}", savedUser.getUsername());

        return generateAuthResponse(savedUser);
    }

    /**
     * {@inheritDoc}
     *
     * <p>Authenticates the user by matching the raw password against the
     * stored BCrypt hash. Returns JWT tokens on success.</p>
     */
    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        var user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new BusinessException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException("Invalid username or password");
        }

        if (!user.isEnabled()) {
            throw new BusinessException("Account is disabled");
        }

        log.info("User logged in successfully: {}", user.getUsername());
        return generateAuthResponse(user);
    }

    /**
     * {@inheritDoc}
     *
     * <p>Validates the refresh token, loads the user, and generates
     * a new pair of access and refresh tokens.</p>
     */
    @Override
    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateRefreshToken(refreshToken)) {
            throw new BusinessException("Invalid or expired refresh token");
        }

        var username = jwtTokenProvider.getUsernameFromToken(refreshToken);
        var user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException("User not found for refresh token"));

        if (!user.isEnabled()) {
            throw new BusinessException("Account is disabled");
        }

        log.debug("Token refreshed for user: {}", username);
        return generateAuthResponse(user);
    }

    /**
     * Finds a user by username.
     *
     * @param username the username to search for
     * @return the User entity, or null if not found
     */
    @Override
    public User findByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    /**
     * Generates an AuthResponse containing access and refresh tokens.
     *
     * @param user the authenticated user
     * @return the authentication response with tokens
     */
    private AuthResponse generateAuthResponse(User user) {
        var accessToken = jwtTokenProvider.generateAccessToken(
                user.getUsername(), user.getRole().name());
        var refreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());

        // Persist refresh token for potential revocation
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        return AuthResponse.of(
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpirationSeconds(),
                user.getUsername(),
                user.getEmail(),
                user.getRole()
        );
    }
}
