package com.deepagent.orchestrator.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.util.PrincipalUtils;
import com.deepagent.orchestrator.dto.AgentTaskRequest;
import com.deepagent.orchestrator.dto.AgentTaskResponse;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import com.deepagent.project.service.ProjectService;
import com.deepagent.scheduler.service.TaskService;
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
 * <p>All endpoints require JWT authentication. {@code POST /execute} additionally
 * verifies that the caller owns the referenced project (and task, when supplied):
 * the gateway forwards the task to agent-runtime with its internal API key, so an
 * unauthenticated-ownership check here would let any logged-in user execute agent
 * tasks against another user's project.</p>
 */
@RestController
@RequestMapping("/api/v1/orchestrator")
@RequiredArgsConstructor
public class OrchestratorController {

    private final AgentOrchestrator agentOrchestrator;
    private final ProjectService projectService;
    private final TaskService taskService;

    @PostMapping("/execute")
    public ApiResponse<AgentTaskResponse> executeTask(
            @Valid @RequestBody AgentTaskRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        verifyOwnership(request, ownerId);

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
     * Health probe for the gRPC connection to agent-runtime.
     *
     * <p>Deliberately left at "any authenticated user" (not ADMIN-only) so the
     * existing dashboard health widget keeps working; it exposes only a boolean.</p>
     */
    @GetMapping("/health")
    public ApiResponse<Boolean> checkAgentServiceHealth() {
        var healthy = agentOrchestrator.isAgentServiceHealthy();
        return ApiResponse.success(healthy);
    }

    /**
     * 校验调用者对请求中的项目（以及任务）拥有所有权。
     *
     * <p>两个查询都按 ownerId 严格过滤：不属于自己的资源会被当作不存在处理
     * （{@code BusinessException("... not found")} → 400），不泄露资源是否存在。</p>
     */
    private void verifyOwnership(AgentTaskRequest request, Long ownerId) {
        projectService.getProject(request.projectId(), ownerId);
        if (request.taskId() != null) {
            taskService.getTask(request.taskId(), ownerId);
        }
    }
}
