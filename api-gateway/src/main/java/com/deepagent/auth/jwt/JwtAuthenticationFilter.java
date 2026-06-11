package com.deepagent.auth.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * JWT authentication filter that validates tokens on every request.
 *
 * <p>This filter executes once per request and performs the following:</p>
 * <ol>
 *   <li>Extracts the JWT token from the Authorization header</li>
 *   <li>Validates the token signature and expiration</li>
 *   <li>Checks if the token has been revoked (via Redis blacklist)</li>
 *   <li>Loads the user details and sets the SecurityContext</li>
 * </ol>
 *
 * <p>Token revocation is supported through a Redis-based blacklist.
 * When a token is revoked, its JTI is stored in Redis with a TTL
 * matching the token's remaining validity period.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String TOKEN_BLACKLIST_PREFIX = "jwt:blacklist:";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Processes each HTTP request to validate the JWT token.
     *
     * @param request     the HTTP request
     * @param response    the HTTP response
     * @param filterChain the filter chain
     * @throws ServletException if a servlet error occurs
     * @throws IOException      if an I/O error occurs
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        var token = extractTokenFromRequest(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.validateAccessToken(token)) {
            if (!isTokenRevoked(token)) {
                authenticateUser(token);
            } else {
                log.debug("Revoked token detected, skipping authentication");
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extracts the JWT token from the Authorization header.
     *
     * @param request the HTTP request
     * @return the token string, or null if not present
     */
    private String extractTokenFromRequest(HttpServletRequest request) {
        var bearerToken = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        return null;
    }

    /**
     * Checks if the token has been revoked via the Redis blacklist.
     *
     * @param token the JWT token
     * @return true if the token is revoked
     */
    private boolean isTokenRevoked(String token) {
        var tokenId = jwtTokenProvider.getTokenId(token);
        var key = TOKEN_BLACKLIST_PREFIX + tokenId;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Authenticates the user by loading details and setting the SecurityContext.
     *
     * @param token the validated JWT token
     */
    private void authenticateUser(String token) {
        try {
            var username = jwtTokenProvider.getUsernameFromToken(token);
            var userDetails = userDetailsService.loadUserByUsername(username);

            var authentication = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());

            SecurityContextHolder.getContext().setAuthentication(authentication);
            log.debug("Authenticated user: {}", username);
        } catch (Exception e) {
            log.error("Failed to authenticate user from token: {}", e.getMessage());
            SecurityContextHolder.clearContext();
        }
    }
}
