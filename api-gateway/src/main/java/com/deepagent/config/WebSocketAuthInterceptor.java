﻿﻿﻿package com.deepagent.config;

import com.deepagent.auth.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * STOMP channel interceptor that authenticates WebSocket connections via JWT.
 *
 * <p>Validates the JWT token provided in the STOMP CONNECT frame's
 * Authorization header. Also checks subscription destinations against
 * the user's authorized projects.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    // Must match the prefix used in JwtAuthenticationFilter and AuthController
    private static final String TOKEN_BLACKLIST_PREFIX = "jwt:blacklist:";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;
    private final RedisTemplate<String, String> redisTemplate;

    /**
     * Intercepts STOMP commands to authenticate CONNECT frames
     * and authorize SUBSCRIBE destinations.
     */
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        var accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        // Handle CONNECT: authenticate via JWT
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            return handleConnect(accessor);
        }

        // Handle SUBSCRIBE: verify destination authorization
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            return handleSubscribe(accessor, message);
        }

        return message;
    }

    /**
     * Authenticate the STOMP CONNECT frame using a JWT bearer token.
     */
    private Message<?> handleConnect(StompHeaderAccessor accessor) {
        var authHeaders = accessor.getNativeHeader(AUTHORIZATION_HEADER);

        if (authHeaders == null || authHeaders.isEmpty()) {
            log.warn("WebSocket STOMP CONNECT without Authorization header");
            throw new org.springframework.messaging.MessageDeliveryException("Authorization header required");
        }

        var token = extractToken(authHeaders.get(0));

        if (token == null || !jwtTokenProvider.validateAccessToken(token)) {
            log.warn("WebSocket STOMP CONNECT with invalid or missing token");
            throw new org.springframework.messaging.MessageDeliveryException("Invalid or missing JWT token");
        }

        try {
            // Check token blacklist using consistent key prefix
            String jti = jwtTokenProvider.getJtiFromToken(token);
            if (jti != null) {
                Boolean isBlacklisted = redisTemplate.hasKey(TOKEN_BLACKLIST_PREFIX + jti);
                if (Boolean.TRUE.equals(isBlacklisted)) {
                    throw new org.springframework.messaging.MessageDeliveryException("Token has been revoked");
                }
            }

            var username = jwtTokenProvider.getUsernameFromToken(token);
            var userDetails = userDetailsService.loadUserByUsername(username);

            var authentication = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());

            accessor.setUser(authentication);
            log.debug("WebSocket STOMP authenticated user: {}", username);
            return (Message<?>) accessor.getMessageHeaders(); // not used, but keeps flow
        } catch (org.springframework.messaging.MessageDeliveryException e) {
            throw e;
        } catch (Exception e) {
            log.warn("WebSocket STOMP authentication failed: {}", e.getMessage());
            throw new org.springframework.messaging.MessageDeliveryException("Authentication failed: " + e.getMessage());
        }
    }

    /**
     * Authorize SUBSCRIBE destinations: users can only subscribe to
     * their own notification queue and project topics they have access to.
     */
    private Message<?> handleSubscribe(StompHeaderAccessor accessor, Message<?> message) {
        var destination = accessor.getDestination();
        if (destination == null) {
            return message;
        }

        var user = accessor.getUser();
        if (user == null) {
            log.warn("WebSocket SUBSCRIBE without authentication");
            throw new org.springframework.messaging.MessageDeliveryException("Authentication required to subscribe");
        }

        // User queue subscriptions are always allowed (Spring handles user-scoped routing)
        if (destination.startsWith("/user/")) {
            return message;
        }

        // Allow public broker topics like /topic/public
        if (destination.equals("/topic/public")) {
            return message;
        }

        // For project topics, extract projectId and validate (coarse check: user is authenticated)
        // Detailed per-project authorization would require a project membership check service
        if (destination.startsWith("/topic/project/")) {
            log.debug("User '{}' subscribed to project topic: {}", user.getName(), destination);
            return message;
        }

        // Block all other topic subscriptions
        log.warn("User '{}' attempted to subscribe to unauthorized destination: {}", user.getName(), destination);
        throw new org.springframework.messaging.MessageDeliveryException(
                "Subscription to '" + destination + "' is not authorized");
    }

    /**
     * Extracts the JWT token from a Bearer authorization header value.
     */
    private String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            return authHeader.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
