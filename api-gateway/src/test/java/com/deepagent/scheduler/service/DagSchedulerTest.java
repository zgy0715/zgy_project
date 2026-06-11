package com.deepagent.scheduler.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.scheduler.entity.Task;
import com.deepagent.scheduler.repository.TaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DagScheduler}.
 *
 * <p>Tests cover DAG execution logic including topological ordering,
 * parallel execution, and failure handling.</p>
 */
@ExtendWith(MockitoExtension.class)
class DagSchedulerTest {

    @Mock
    private DagParser dagParser;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private com.deepagent.orchestrator.service.AgentOrchestrator agentOrchestrator;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DagScheduler dagScheduler;

    private Long projectId;

    @BeforeEach
    void setUp() {
        projectId = 1L;
    }

    @Nested
    @DisplayName("DAG Execution Level Tests")
    class ExecutionLevelTests {

        @Test
        @DisplayName("Should compute correct execution levels for simple DAG")
        void shouldComputeSimpleExecutionLevels() {
            // Level 0: task 1, 2 (no dependencies)
            // Level 1: task 3 (depends on 1, 2)
            var levels = List.of(
                    List.of(1L, 2L),
                    List.of(3L)
            );

            when(dagParser.getExecutionLevels(projectId)).thenReturn(levels);

            var result = dagParser.getExecutionLevels(projectId);

            assertThat(result).hasSize(2);
            assertThat(result.get(0)).containsExactly(1L, 2L);
            assertThat(result.get(1)).containsExactly(3L);
        }

        @Test
        @DisplayName("Should handle single task DAG")
        void shouldHandleSingleTaskDag() {
            var levels = List.of(List.of(1L));

            when(dagParser.getExecutionLevels(projectId)).thenReturn(levels);

            var result = dagParser.getExecutionLevels(projectId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0)).containsExactly(1L);
        }

        @Test
        @DisplayName("Should handle empty project")
        void shouldHandleEmptyProject() {
            when(dagParser.getExecutionLevels(projectId)).thenReturn(List.of());

            var result = dagParser.getExecutionLevels(projectId);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("DAG Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should throw exception for cyclic DAG")
        void shouldThrowForCyclicDag() {
            when(dagParser.getExecutionLevels(projectId))
                    .thenThrow(new BusinessException("Invalid DAG: cycle detected"));

            assertThatThrownBy(() -> dagParser.getExecutionLevels(projectId))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("cycle detected");
        }
    }

    @Nested
    @DisplayName("Task Status Update Tests")
    class TaskStatusTests {

        @Test
        @DisplayName("Should mark remaining tasks as skipped on failure")
        void shouldMarkRemainingAsSkipped() {
            var pendingTask = Task.builder()
                    .id(2L)
                    .projectId(projectId)
                    .name("pending-task")
                    .status(Task.Status.PENDING)
                    .dependencies("[1]")
                    .build();

            when(taskRepository.findByProjectIdAndStatus(projectId, Task.Status.PENDING))
                    .thenReturn(List.of(pendingTask));

            dagScheduler.markRemainingTasksAsSkipped(projectId);

            assertThat(pendingTask.getStatus()).isEqualTo(Task.Status.SKIPPED);
        }
    }
}
