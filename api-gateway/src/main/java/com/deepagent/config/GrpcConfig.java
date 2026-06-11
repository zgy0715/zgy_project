package com.deepagent.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * gRPC client configuration for communicating with the Python agent service.
 *
 * <p>Creates a managed gRPC channel with appropriate keep-alive settings
 * for long-running agent tasks. The channel uses plaintext communication
 * in development and can be configured for TLS in production.</p>
 */
@Slf4j
@Configuration
public class GrpcConfig {

    @Value("${grpc.client.agent-service.host:localhost}")
    private String agentServiceHost;

    @Value("${grpc.client.agent-service.port:50051}")
    private int agentServicePort;

    @Value("${grpc.client.agent-service.keep-alive-time:30}")
    private long keepAliveTime;

    @Value("${grpc.client.agent-service.keep-alive-timeout:10}")
    private long keepAliveTimeout;

    @Value("${grpc.client.agent-service.enable-keep-alive:true}")
    private boolean enableKeepAlive;

    /**
     * Creates a managed gRPC channel for the Python agent service.
     *
     * <p>The channel is configured with:</p>
     * <ul>
     *   <li>Keep-alive pings to maintain connection</li>
     *   <li>Idle timeout for resource cleanup</li>
     *   <li>Plaintext negotiation (upgrade to TLS for production)</li>
     * </ul>
     *
     * @return the configured ManagedChannel
     */
    @Bean
    public ManagedChannel agentServiceChannel() {
        log.info("Creating gRPC channel to agent service at {}:{}",
                agentServiceHost, agentServicePort);

        var builder = ManagedChannelBuilder
                .forAddress(agentServiceHost, agentServicePort)
                .idleTimeout(5, TimeUnit.MINUTES);

        if (enableKeepAlive) {
            builder.keepAliveTime(keepAliveTime, TimeUnit.SECONDS)
                    .keepAliveTimeout(keepAliveTimeout, TimeUnit.SECONDS)
                    .keepAliveWithoutCalls(false);
        }

        // Use plaintext for development; switch to useTransportSecurity() for production
        builder.usePlaintext();

        return builder.build();
    }
}
