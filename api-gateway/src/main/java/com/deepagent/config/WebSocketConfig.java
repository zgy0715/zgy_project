package com.deepagent.config;

import com.deepagent.websocket.AgentWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket configuration with STOMP protocol support.
 *
 * <p>Sets up a message broker for real-time agent output streaming.
 * Agents publish their output to topic-based destinations, and
 * subscribed clients receive updates in real-time.</p>
 *
 * <p>Endpoint: {@code /ws} with SockJS fallback</p>
 * <p>Application destination prefix: {@code /app}</p>
 * <p>User destination prefix: {@code /user}</p>
 * <p>Broker prefix: {@code /topic}, {@code /queue}</p>
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final AgentWebSocketHandler agentWebSocketHandler;
    private final WebSocketAuthInterceptor webSocketAuthInterceptor;

    /**
     * Configures the message broker for STOMP messaging.
     *
     * @param config the message broker registry
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefix("/app");
        config.setUserDestinationPrefix("/user");
    }

    /**
     * Registers STOMP endpoints with SockJS fallback for WebSocket communication.
     *
     * @param registry the STOMP endpoint registry
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    /**
     * Configures the client inbound channel to authenticate STOMP CONNECT frames.
     *
     * <p>Registers the {@link WebSocketAuthInterceptor} to validate JWT tokens
     * from STOMP CONNECT headers before processing any messages.</p>
     *
     * @param registration the channel registration
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor);
    }
}
