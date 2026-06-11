package com.deepagent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main entry point for the DeepAgent API Gateway application.
 *
 * <p>This Spring Boot application serves as the API gateway for the DeepAgent
 * multi-AI agent collaboration platform. It provides authentication, project management,
 * task scheduling, and agent orchestration capabilities.</p>
 *
 * <p>Key features enabled:</p>
 * <ul>
 *   <li>Async processing via virtual threads</li>
 *   <li>Scheduled task execution</li>
 *   <li>WebSocket support for real-time agent output</li>
 *   <li>gRPC client for Python agent service communication</li>
 * </ul>
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class DeepAgentApplication {

    /**
     * Application entry point.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(DeepAgentApplication.class, args);
    }
}
