package com.deepagent.orchestrator.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.dto.AgentTaskRequest;
import com.deepagent.orchestrator.dto.AgentTaskResponse;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for agent orchestration endpoints.
 *
 * <p>Provides endpoints for submitting tasks to AI agents and
 * checking the health of the agent service.</p>
 */
@RestController
@RequestMapping("/api/v1/orchestrator")
@RequiredArgsConstructor
public class OrchestratorController {

    private final AgentOrchestrator agentOrchestrator;

    /**
     * Submits an agent task for execution.
     *
     * <p>If the request has streaming enabled, the task output will be
     * streamed via WebSocket to the topic {@code /topic/project/{projectId}/task/{taskId}}.</p>
     *
     * @param request the agent task request
     * @return the agent task response
     */
    @PostMapping("/execute")
    public ApiResponse<AgentTaskResponse> executeTask(
            @Valid @RequestBody AgentTaskRequest request) {
        if (Boolean.TRUE.equals(request.stream())) {
            var response = agentOrchestrator.executeAgentTaskStream(request);
            return ApiResponse.success(response, "Task submitted for streaming execution");
        } else {
            var output = agentOrchestrator.executeAgentTask(
                    request.projectId(), request.taskId(),
                    request.agentType(), request.input());
            var response = AgentTaskResponse.completed(
                    request.taskId(), request.projectId(),
                    request.agentType(), output, java.time.LocalDateTime.now());
            return ApiResponse.success(response);
        }
    }

    /**
     * Checks the health of the Python agent service.
     *
     * @return health status
     */
    @GetMapping("/health")
    public ApiResponse<Boolean> checkAgentServiceHealth() {
        var healthy = agentOrchestrator.isAgentServiceHealthy();
        return ApiResponse.success(healthy);
    }
}
