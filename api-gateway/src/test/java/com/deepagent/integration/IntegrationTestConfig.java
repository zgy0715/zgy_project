package com.deepagent.integration;

import com.deepagent.auth.jwt.JwtTokenProvider;
import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.client.AgentRestClient;
import okhttp3.mockwebserver.MockWebServer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;

/**
 * Test configuration for integration tests.
 *
 * <p>Sets up the test environment with:</p>
 * <ul>
 *   <li>MockWebServer to simulate the Python Agent Runtime</li>
 *   <li>AgentRestClient pointed at the mock server</li>
 *   <li>Relaxed security for test endpoints</li>
 * </ul>
 */
@TestConfiguration
@ActiveProfiles("test")
public class IntegrationTestConfig {

    /**
     * Creates a MockWebServer instance to simulate the Python Agent Runtime.
     *
     * <p>The mock server allows us to verify that the Java gateway
     * sends the correct HTTP requests to the Python backend, including
     * correct paths, methods, headers, and request bodies.</p>
     *
     * @return a started MockWebServer instance
     * @throws IOException if the server fails to start
     */
    @Bean
    public MockWebServer mockWebServer() throws IOException {
        MockWebServer server = new MockWebServer();
        server.start();
        return server;
    }

    /**
     * Creates an AgentRestClient configured to use the mock server.
     *
     * <p>This replaces the production AgentRestClient bean so that
     * all HTTP calls are directed to the MockWebServer instead of
     * the real Python runtime.</p>
     *
     * @param mockWebServer the mock server to target
     * @return an AgentRestClient pointing at the mock server
     */
    @Bean
    @Primary
    public AgentRestClient agentRestClient(MockWebServer mockWebServer) {
        String baseUrl = String.format("http://localhost:%d", mockWebServer.getPort());
        return new AgentRestClient(baseUrl);
    }

    /**
     * Configures a permissive security filter chain for integration tests.
     *
     * <p>Disables CSRF and permits all requests so that integration
     * tests can exercise controller endpoints without JWT tokens.</p>
     *
     * @param http the HttpSecurity builder
     * @return a permissive SecurityFilterChain
     * @throws Exception if configuration fails
     */
    @Bean
    @Primary
    public SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll())
                .build();
    }
}
