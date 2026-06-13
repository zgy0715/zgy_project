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

/**
 * JWT token provider for generating and validating JSON Web Tokens.
 *
 * <p>Handles the complete lifecycle of JWT tokens:</p>
 * <ul>
 *   <li>Access token generation with configurable expiration</li>
 *   <li>Refresh token generation with longer expiration</li>
 *   <li>Token validation and claims extraction</li>
 *   <li>Token revocation support via JTI (JWT ID)</li>
 * </ul>
 *
 * <p>Uses HMAC-SHA256 signing algorithm with a configurable secret key.</p>
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    /**
     * Constructs the JwtTokenProvider with configuration values.
     *
     * @param secret                    the Base64-encoded secret key for JWT signing
     * @param accessTokenExpirationMs   access token expiration in milliseconds
     * @param refreshTokenExpirationMs  refresh token expiration in milliseconds
     */
    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiration:3600000}") long accessTokenExpirationMs,
            @Value("${jwt.refresh-token-expiration:86400000}") long refreshTokenExpirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    /**
     * Generates a JWT access token for the given username and role.
     *
     * @param username the subject username
     * @param role     the user's role
     * @return the signed JWT access token string
     */
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

    /**
     * Generates a JWT refresh token for the given username.
     *
     * @param username the subject username
     * @return the signed JWT refresh token string
     */
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

    /**
     * Extracts the username (subject) from a JWT token.
     *
     * @param token the JWT token
     * @return the username stored in the token subject
     */
    public String getUsernameFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * Extracts the user role from a JWT access token.
     *
     * @param token the JWT access token
     * @return the role claim value
     */
    public String getRoleFromToken(String token) {
        return parseClaims(token).get("role", String.class);
    }

    /**
     * Extracts the JWT ID (JTI) from a token.
     *
     * @param token the JWT token
     * @return the unique token identifier
     */
    public String getTokenId(String token) {
        return parseClaims(token).getId();
    }

    /**
     * Validates a JWT access token.
     *
     * @param token the JWT token to validate
     * @return true if the token is valid and is an access token
     */
    public boolean validateAccessToken(String token) {
        try {
            var claims = parseClaims(token);
            return "access".equals(claims.get("type", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid access token: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Validates a JWT refresh token.
     *
     * @param token the JWT refresh token to validate
     * @return true if the token is valid and is a refresh token
     */
    public boolean validateRefreshToken(String token) {
        try {
            var claims = parseClaims(token);
            return "refresh".equals(claims.get("type", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid refresh token: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Gets the access token expiration time in seconds.
     *
     * @return expiration time in seconds
     */
    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationMs / 1000;
    }

    /**
     * Gets the refresh token expiration time in seconds.
     *
     * @return expiration time in seconds
     */
    public long getRefreshTokenExpirationSeconds() {
        return refreshTokenExpirationMs / 1000;
    }

    /**
     * Parses and returns the claims from a JWT token.
     *
     * @param token the JWT token
     * @return the parsed claims
     * @throws JwtException if the token is invalid or expired
     */
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
