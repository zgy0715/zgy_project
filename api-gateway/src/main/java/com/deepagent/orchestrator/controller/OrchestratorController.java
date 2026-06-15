package com.deepagent.orchestrator.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.dto.AgentTaskRequest;
import com.deepagent.orchestrator.dto.AgentTaskResponse;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for agent orchestration endpoints.
 *
 * <p>All endpoints require JWT authentication.</p>
 */
@RestController
@RequestMapping("/api/v1/orchestrator")
@RequiredArgsConstructor
public class OrchestratorController {

    private final AgentOrchestrator agentOrchestrator;

    @PostMapping("/execute")
    public ApiResponse<AgentTaskResponse> executeTask(
            @Valid @RequestBody AgentTaskRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
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

    @GetMapping("/health")
    public ApiResponse<Boolean> checkAgentServiceHealth() {
        var healthy = agentOrchestrator.isAgentServiceHealthy();
        return ApiResponse.success(healthy);
    }
}
