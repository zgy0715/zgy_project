package com.deepagent.common.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Rate limiting filter to prevent brute force and DoS attacks.
 *
 * <p>Uses a token-bucket-like sliding window approach, backed by
 * ConcurrentHashMap for single-instance deployments and Redis
 * for multi-instance deployments. Applies strict limits to auth
 * endpoints and moderate limits to general API endpoints.</p>
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // In-memory fallback rate store (used when Redis is unavailable)
    private final ConcurrentHashMap<String, Bucket> inMemoryStore = new ConcurrentHashMap<>();

    private final RedisTemplate<String, Object> redisTemplate;
    private final boolean useRedis;

    // Auth endpoints: max 10 requests per minute per IP
    private static final int AUTH_MAX_REQUESTS = 10;
    private static final long AUTH_WINDOW_SECONDS = 60;

    // General API: max 100 requests per minute per user/IP
    private static final int API_MAX_REQUESTS = 100;
    private static final long API_WINDOW_SECONDS = 60;

    public RateLimitFilter(@Value("${rate-limit.enabled:true}") boolean enabled,
                           RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.useRedis = redisTemplate != null && enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Skip rate limiting for WebSocket upgrade requests
        String upgradeHeader = request.getHeader("Upgrade");
        if ("websocket".equalsIgnoreCase(upgradeHeader)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientKey = resolveClientKey(request);
        boolean isAuthEndpoint = request.getRequestURI().contains("/auth/");

        int maxRequests = isAuthEndpoint ? AUTH_MAX_REQUESTS : API_MAX_REQUESTS;
        long windowSeconds = isAuthEndpoint ? AUTH_WINDOW_SECONDS : API_WINDOW_SECONDS;

        boolean allowed;
        if (useRedis) {
            allowed = checkRedisRateLimit(clientKey, maxRequests, windowSeconds);
        } else {
            allowed = checkMemoryRateLimit(clientKey, maxRequests, windowSeconds);
        }

        if (!allowed) {
            log.warn("Rate limit exceeded for client: {} (endpoint: {})", clientKey, request.getRequestURI());
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                "{\"success\":false,\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please try again later.\",\"data\":null}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Resolve a unique client identifier from IP or authenticated user.
     */
    private String resolveClientKey(HttpServletRequest request) {
        var userPrincipal = request.getUserPrincipal();
        if (userPrincipal != null) {
            return "user:" + userPrincipal.getName();
        }
        String xff = request.getHeader("X-Forwarded-For");
        String ip = (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
        return "ip:" + ip;
    }

    /**
     * In-memory sliding window rate check.
     */
    private boolean checkMemoryRateLimit(String key, int maxRequests, long windowSeconds) {
        long now = System.nanoTime();
        long windowNanos = windowSeconds * 1_000_000_000L;

        Bucket bucket = inMemoryStore.compute(key, (k, existing) -> {
            if (existing == null || (now - existing.windowStart) > windowNanos) {
                return new Bucket(now, 1);
            }
            existing.count++;
            return existing;
        });

        return bucket.count <= maxRequests;
    }

    /**
     * Redis-based sliding window rate check.
     */
    private boolean checkRedisRateLimit(String key, int maxRequests, long windowSeconds) {
        try {
            String redisKey = "ratelimit:" + key;
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count != null && count == 1) {
                redisTemplate.expire(redisKey, windowSeconds, TimeUnit.SECONDS);
            }
            return count != null && count <= maxRequests;
        } catch (Exception e) {
            log.warn("Redis rate limit check failed, falling back to in-memory: {}", e.getMessage());
            return checkMemoryRateLimit(key, maxRequests, windowSeconds);
        }
    }

    /**
     * Simple token bucket entry for in-memory rate tracking.
     */
    private record Bucket(long windowStart, int count) {}
}
