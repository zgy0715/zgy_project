package com.deepagent.orchestrator.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.dto.AgentTaskRequest;
import com.deepagent.orchestrator.dto.AgentTaskResponse;
import com.deepagent.orchestrator.grpc.AgentServiceGrpcClient;
import com.deepagent.websocket.AgentEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AgentOrchestrator}.
 *
 * <p>Tests cover agent task execution, streaming, and error handling.</p>
 */
@ExtendWith(MockitoExtension.class)
class AgentOrchestratorTest {

    @Mock
    private AgentServiceGrpcClient grpcClient;

    @Mock
    private AgentEventPublisher eventPublisher;

    @InjectMocks
    private AgentOrchestrator agentOrchestrator;

    private Long projectId;
    private Long taskId;

    @BeforeEach
    void setUp() {
        projectId = 1L;
        taskId = 100L;
    }

    @Nested
    @DisplayName("Synchronous Task Execution Tests")
    class SyncExecutionTests {

        @Test
        @DisplayName("Should execute agent task successfully")
        void shouldExecuteAgentTask() {
            var grpcResponse = AgentTaskResponse.completed(
                    taskId, projectId, "code-review", "Review completed", java.time.LocalDateTime.now());

            when(grpcClient.submitTask(projectId, taskId, "code-review", "input data"))
                    .thenReturn(grpcResponse);

            var result = agentOrchestrator.executeAgentTask(
                    projectId, taskId, "code-review", "input data");

            assertThat(result).isEqualTo("Review completed");
            verify(eventPublisher).publishTaskStarted(projectId, taskId, "code-review");
            verify(eventPublisher).publishTaskCompleted(projectId, taskId, "code-review", "Review completed");
        }

        @Test
        @DisplayName("Should throw exception when agent task fails")
        void shouldThrowOnAgentTaskFailure() {
            var grpcResponse = AgentTaskResponse.failed(
                    taskId, projectId, "code-review", "Agent crashed", java.time.LocalDateTime.now());

            when(grpcClient.submitTask(projectId, taskId, "code-review", "input"))
                    .thenReturn(grpcResponse);

            assertThatThrownBy(() -> agentOrchestrator.executeAgentTask(
                    projectId, taskId, "code-review", "input"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Agent task failed");

            verify(eventPublisher).publishTaskFailed(projectId, taskId, "code-review", "Agent crashed");
        }

        @Test
        @DisplayName("Should publish failed event on unexpected exception")
        void shouldPublishFailedOnUnexpectedException() {
            when(grpcClient.submitTask(projectId, taskId, "code-review", "input"))
                    .thenThrow(new RuntimeException("Connection refused"));

            assertThatThrownBy(() -> agentOrchestrator.executeAgentTask(
                    projectId, taskId, "code-review", "input"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Agent task execution error");

            verify(eventPublisher).publishTaskFailed(projectId, taskId, "code-review", "Connection refused");
        }
    }

    @Nested
    @DisplayName("Streaming Task Execution Tests")
    class StreamExecutionTests {

        @Test
        @DisplayName("Should return running status for streaming task")
        void shouldReturnRunningForStreamingTask() {
            var request = new AgentTaskRequest(projectId, taskId, "code-review", "input", true);

            var response = agentOrchestrator.executeAgentTaskStream(request);

            assertThat(response).isNotNull();
            assertThat(response.status()).isEqualTo("RUNNING");
            assertThat(response.taskId()).isEqualTo(taskId);
            assertThat(response.projectId()).isEqualTo(projectId);
            verify(eventPublisher).publishTaskStarted(projectId, taskId, "code-review");
        }
    }

    @Nested
    @DisplayName("Health Check Tests")
    class HealthCheckTests {

        @Test
        @DisplayName("Should return true when agent service is healthy")
        void shouldReturnTrueWhenHealthy() {
            when(grpcClient.isHealthy()).thenReturn(true);

            var result = agentOrchestrator.isAgentServiceHealthy();

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("Should return false when agent service is unhealthy")
        void shouldReturnFalseWhenUnhealthy() {
            when(grpcClient.isHealthy()).thenReturn(false);

            var result = agentOrchestrator.isAgentServiceHealthy();

            assertThat(result).isFalse();
        }
    }
}
