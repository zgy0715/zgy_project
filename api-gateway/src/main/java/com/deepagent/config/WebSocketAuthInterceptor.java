package com.deepagent.config;

import com.deepagent.auth.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * Authorization header. If the token is valid, the user details are
 * set on the STOMP session for downstream authorization checks.</p>
 *
 * <p>Clients should include the JWT token in the STOMP CONNECT headers:</p>
 * <pre>
 * STOMP headers:
 *   Authorization: Bearer &lt;jwt-token&gt;
 * </pre>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    /**
     * Intercepts STOMP commands to authenticate CONNECT frames.
     *
     * @param message    the STOMP message
     * @param channel    the message channel
     * @return the message if authentication succeeds, or the original message for non-CONNECT commands
     */
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        var accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            var authHeaders = accessor.getNativeHeader(AUTHORIZATION_HEADER);

            if (authHeaders != null && !authHeaders.isEmpty()) {
                var authHeader = authHeaders.get(0);
                var token = extractToken(authHeader);

                if (token != null && jwtTokenProvider.validateAccessToken(token)) {
                    try {
                        var username = jwtTokenProvider.getUsernameFromToken(token);
                        var userDetails = userDetailsService.loadUserByUsername(username);

                        var authentication = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());

                        accessor.setUser(authentication);
                        log.debug("WebSocket STOMP authenticated user: {}", username);
                    } catch (Exception e) {
                        log.warn("WebSocket STOMP authentication failed: {}", e.getMessage());
                    }
                } else {
                    log.warn("WebSocket STOMP CONNECT with invalid or missing token");
                }
            } else {
                log.debug("WebSocket STOMP CONNECT without Authorization header");
            }
        }

        return message;
    }

    /**
     * Extracts the JWT token from a Bearer authorization header value.
     *
     * @param authHeader the Authorization header value
     * @return the token string, or null if malformed
     */
    private String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            return authHeader.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
