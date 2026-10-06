package com.deepagent.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import jakarta.annotation.PreDestroy;
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
 * unless {@code grpc.client.agent-service.tls-enabled=true} is set, and it is
 * shut down with the Spring context so the Netty transport does not leak.</p>
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

    @Value("${grpc.client.agent-service.tls-enabled:false}")
    private boolean tlsEnabled;

    /** Channel handle kept for deterministic shutdown on context close. */
    private ManagedChannel managedChannel;

    /**
     * Creates a managed gRPC channel for the Python agent service.
     *
     * <p>The channel is configured with:</p>
     * <ul>
     *   <li>Keep-alive pings to maintain connection</li>
     *   <li>Idle timeout for resource cleanup</li>
     *   <li>Plaintext negotiation by default; TLS when
     *       {@code grpc.client.agent-service.tls-enabled=true}</li>
     * </ul>
     *
     * @return the configured ManagedChannel
     */
    @Bean
    public ManagedChannel agentServiceChannel() {
        log.info("Creating gRPC channel to agent service at {}:{}", agentServiceHost, agentServicePort);

        var builder = ManagedChannelBuilder
                .forAddress(agentServiceHost, agentServicePort)
                .idleTimeout(5, TimeUnit.MINUTES);

        if (enableKeepAlive) {
            builder.keepAliveTime(keepAliveTime, TimeUnit.SECONDS)
                    .keepAliveTimeout(keepAliveTimeout, TimeUnit.SECONDS)
                    .keepAliveWithoutCalls(false);
        }

        if (tlsEnabled) {
            builder.useTransportSecurity();
            log.info("gRPC channel to agent service uses TLS");
        } else {
            builder.usePlaintext();
            log.warn("gRPC channel to agent service is PLAINTEXT; set "
                    + "grpc.client.agent-service.tls-enabled=true for production");
        }

        managedChannel = builder.build();
        return managedChannel;
    }

    /**
     * 关闭 gRPC channel：先优雅关闭，超时后强制关闭，并恢复中断标记。
     */
    @PreDestroy
    public void shutdownChannel() {
        var channel = this.managedChannel;
        if (channel == null) {
            return;
        }
        channel.shutdown();
        try {
            if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                channel.shutdownNow();
            }
        } catch (InterruptedException e) {
            channel.shutdownNow();
            Thread.currentThread().interrupt();
        }
        log.info("gRPC channel to agent service has been shut down");
    }
}
