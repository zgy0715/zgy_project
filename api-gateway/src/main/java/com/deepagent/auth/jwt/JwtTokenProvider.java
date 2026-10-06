package com.deepagent.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import jakarta.annotation.PostConstruct;

/**
 * JWT token provider for generating and validating JSON Web Tokens.
 *
 * <p>Handles the complete lifecycle of JWT tokens with HMAC-SHA256 signing.
 * Enforces a minimum 256-bit (32-character) secret key for production safety.</p>
 */
@Slf4j
@Component
public class JwtTokenProvider {

    // Minimum key length for HMAC-SHA256 in bytes (256-bit)
    private static final int MIN_SECRET_LENGTH = 32;

    private final String secret;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    private SecretKey signingKey;

    public JwtTokenProvider(
            @Value("${jwt.secret:}") String secret,
            @Value("${jwt.access-token-expiration:3600000}") long accessTokenExpirationMs,
            @Value("${jwt.refresh-token-expiration:86400000}") long refreshTokenExpirationMs) {
        this.secret = secret;
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
        // 在构造阶段即完成密钥校验，保证直接 new 出来的实例（测试/工具）也可用
        this.signingKey = createSigningKey(secret);
    }

    @PostConstruct
    public void init() {
        this.signingKey = createSigningKey(secret);
    }

    /**
     * Validates the configured secret and derives the HMAC-SHA256 signing key.
     */
    private SecretKey createSigningKey(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET environment variable must be set");
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                "JWT secret must be at least " + MIN_SECRET_LENGTH + " characters long " +
                "(current: " + keyBytes.length + "). Use a strong, randomly generated key."
            );
        }
        // Warn if the secret looks like a default/dev value
        String lowerSecret = secret.toLowerCase();
        if (lowerSecret.contains("dev-only") || lowerSecret.contains("change-in-production")) {
            log.warn("JWT secret appears to be a development/default value. " +
                     "Generate a strong random secret for production use.");
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(String username, String role) {
        var now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("type", "access")
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(accessTokenExpirationMs)))
                .signWith(signingKey)
                .compact();
    }

    public String generateRefreshToken(String username) {
        var now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("type", "refresh")
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(refreshTokenExpirationMs)))
                .signWith(signingKey)
                .compact();
    }

    public String getUsernameFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public String getRoleFromToken(String token) {
        return parseClaims(token).get("role", String.class);
    }

    public String getTokenId(String token) {
        return parseClaims(token).getId();
    }

    public String getJtiFromToken(String token) {
        try {
            return parseClaims(token).getId();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public boolean validateAccessToken(String token) {
        try {
            var claims = parseClaims(token);
            return "access".equals(claims.get("type", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid access token: {}", e.getMessage());
            return false;
        }
    }

    public boolean validateRefreshToken(String token) {
        try {
            var claims = parseClaims(token);
            return "refresh".equals(claims.get("type", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid refresh token: {}", e.getMessage());
            return false;
        }
    }

    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationMs / 1000;
    }

    public long getRefreshTokenExpirationSeconds() {
        return refreshTokenExpirationMs / 1000;
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
