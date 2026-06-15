package com.deepagent.orchestrator.controller;

import com.deepagent.auth.entity.User;
import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.client.AgentRestClient;
import com.deepagent.orchestrator.service.AgentOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST controller for agent management and execution endpoints.
 *
 * <p>All endpoints require JWT authentication. Agent ownership is tracked
 * via a local map (mapping agentId -> userId) to ensure users can only
 * access their own agents.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentRestClient agentRestClient;
    private final AgentOrchestrator agentOrchestrator;

    // In-memory agent ownership tracking: agentId -> userId
    // In a production environment, this should be moved to a database
    private final ConcurrentHashMap<String, Long> agentOwnership = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createAgent(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Creating agent: name={}, user={}", request.get("name"), userDetails.getUsername());

        var ownerId = extractUserId(userDetails);
        // Tag the agent with owner info via metadata
        request.put("owner_id", String.valueOf(ownerId));

        var result = agentRestClient.createAgent(request).block();
        if (result != null && result.containsKey("id")) {
            String agentId = String.valueOf(result.get("id"));
            agentOwnership.put(agentId, ownerId);
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map>> listAgents(
            @RequestParam(required = false) String agentType,
            @RequestParam(required = false) String statusFilter,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Listing agents: agentType={}, statusFilter={}, user={}",
                agentType, statusFilter, userDetails.getUsername());
        var result = agentRestClient.listAgents(agentType, statusFilter).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{agentId}")
    public ResponseEntity<ApiResponse<Map>> getAgent(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getAgent(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/{agentId}/execute")
    public ResponseEntity<ApiResponse<Map>> executeAgent(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Executing agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);

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

    @PostMapping("/{agentId}/chat")
    public ResponseEntity<ApiResponse<Map>> chatWithAgent(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Chat with agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.chatWithAgent(agentId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/{agentId}/chat/stream")
    public Flux<ServerSentEvent<Map>> streamChat(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Streaming chat with agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        return agentRestClient.streamChat(agentId, request)
                .map(data -> ServerSentEvent.<Map>builder().data(data).build());
    }

    @GetMapping("/{agentId}/thinking-chain")
    public ResponseEntity<ApiResponse<Map>> getThinkingChain(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting thinking chain: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getThinkingChain(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{agentId}/messages")
    public ResponseEntity<ApiResponse<Map>> getMessages(
            @PathVariable String agentId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting messages: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getMessages(agentId, limit, offset).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{agentId}/review-findings")
    public ResponseEntity<ApiResponse<Map>> getReviewFindings(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting review findings: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getReviewFindings(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/{agentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAgent(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Deleting agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        agentRestClient.deleteAgent(agentId).block();
        agentOwnership.remove(agentId);
        return ResponseEntity.ok(ApiResponse.success(null, "Agent deleted successfully"));
    }

    /**
     * Verifies that the authenticated user owns the specified agent.
     * Falls back to allowing access if ownership is not yet tracked
     * (e.g., agents created before this update).
     */
    private void verifyAgentOwnership(String agentId, UserDetails userDetails) {
        Long ownerId = agentOwnership.get(agentId);
        if (ownerId != null) {
            Long userId = extractUserId(userDetails);
            if (!ownerId.equals(userId)) {
                throw new BusinessException("Access denied: you do not own this agent");
            }
        }
        // If ownership not tracked (legacy agents), allow access
        // but log a warning for auditing
        if (ownerId == null) {
            log.warn("Agent {} has no tracked owner, allowing access for user {}",
                    agentId, userDetails.getUsername());
        }
    }

    private Long extractUserId(UserDetails userDetails) {
        if (userDetails instanceof User user) {
            return user.getId();
        }
        throw new IllegalStateException("Unexpected principal type: " + userDetails.getClass().getName());
    }

    private Long extractLong(Object value) {
        if (value instanceof Number num) {
            return num.longValue();
        }
        return null;
    }
}
