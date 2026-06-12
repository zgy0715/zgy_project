package com.deepagent.orchestrator.controller;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.client.AgentRestClient;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * REST controller for agent management and execution endpoints.
 *
 * <p>Provides endpoints that proxy agent operations to the Python Agent
 * Runtime. Agent CRUD operations are forwarded via {@link AgentRestClient},
 * while task execution can optionally use the gRPC-based
 * {@link AgentOrchestrator} for streaming support.</p>
 *
 * <p>All endpoints require JWT authentication.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentRestClient agentRestClient;
    private final AgentOrchestrator agentOrchestrator;

    /**
     * Creates a new agent instance.
     *
     * @param request the agent creation request containing name, type, config, etc.
     * @return the created agent details
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createAgent(
            @RequestBody Map<String, Object> request) {
        log.info("Creating agent: name={}", request.get("name"));
        var result = agentRestClient.createAgent(request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Lists all agents with optional filtering.
     *
     * @param agentType    optional filter by agent type
     * @param statusFilter optional filter by agent status
     * @return list of agents
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Map>> listAgents(
            @RequestParam(required = false) String agentType,
            @RequestParam(required = false) String statusFilter) {
        log.debug("Listing agents: agentType={}, statusFilter={}", agentType, statusFilter);
        var result = agentRestClient.listAgents(agentType, statusFilter).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Gets the state of a specific agent.
     *
     * @param agentId the agent identifier
     * @return the agent state including conversation history
     */
    @GetMapping("/{agentId}")
    public ResponseEntity<ApiResponse<Map>> getAgent(
            @PathVariable String agentId) {
        log.debug("Getting agent: agentId={}", agentId);
        var result = agentRestClient.getAgent(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Executes a task on the specified agent.
     *
     * <p>For streaming execution, the task output is published via WebSocket
     * to the topic {@code /topic/project/{projectId}/task/{taskId}}.</p>
     *
     * @param agentId the agent identifier
     * @param request the execution request containing task and context
     * @return the execution result
     */
    @PostMapping("/{agentId}/execute")
    public ResponseEntity<ApiResponse<Map>> executeAgent(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request) {
        log.info("Executing agent: agentId={}", agentId);

        // Check if streaming is requested
        var stream = request.get("stream");
        if (stream instanceof Boolean boolStream && boolStream) {
            var projectId = extractLong(request.get("project_id"));
            var taskId = extractLong(request.get("task_id"));
            var agentType = (String) request.getOrDefault("agent_type", "default");
            var input = request.get("task") instanceof String s ? s : request.toString();

            var taskRequest = new com.deepagent.orchestrator.dto.AgentTaskRequest(
                    projectId, taskId, agentType, input, true);
            var response = agentOrchestrator.executeAgentTaskStream(taskRequest);
            return ResponseEntity.ok(ApiResponse.success(
                    Map.of("taskId", response.taskId(),
                            "status", response.status(),
                            "message", "Streaming execution started")));
        }

        var result = agentRestClient.executeAgent(agentId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Sends a chat message to an agent.
     *
     * <p>Uses the agent execute endpoint with a chat-oriented payload.
     * For streaming responses, set {@code "stream": true} in the request.</p>
     *
     * @param agentId the agent identifier
     * @param request the chat request containing the message
     * @return the chat response
     */
    @PostMapping("/{agentId}/chat")
    public ResponseEntity<ApiResponse<Map>> chatWithAgent(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request) {
        log.info("Chat with agent: agentId={}", agentId);
        var result = agentRestClient.chatWithAgent(agentId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Deletes an agent instance.
     *
     * @param agentId the agent identifier
     * @return success response
     */
    @DeleteMapping("/{agentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAgent(
            @PathVariable String agentId) {
        log.info("Deleting agent: agentId={}", agentId);
        agentRestClient.deleteAgent(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(null, "Agent deleted successfully"));
    }

    /**
     * Extracts a Long value from an object, returning null if not possible.
     */
    private Long extractLong(Object value) {
        if (value instanceof Number num) {
            return num.longValue();
        }
        return null;
    }
}
