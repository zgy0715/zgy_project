package com.deepagent.orchestrator.controller;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.util.PrincipalUtils;
import com.deepagent.orchestrator.client.AgentRestClient;
import com.deepagent.orchestrator.dto.AgentResponse;
import com.deepagent.orchestrator.entity.AgentOwnership;
import com.deepagent.orchestrator.repository.AgentOwnershipRepository;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * REST controller for agent management and execution endpoints.
 *
 * <p>All endpoints require JWT authentication. Agent ownership is persisted in the
 * {@code agent_ownership} table (V2 migration) and every agent-scoped endpoint
 * verifies ownership before calling agent-runtime. Unknown agents are denied
 * (fail-closed) instead of being allowed through.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentRestClient agentRestClient;
    private final AgentOrchestrator agentOrchestrator;
    private final AgentOwnershipRepository agentOwnershipRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createAgent(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        log.info("Creating agent: name={}, user={}", request.get("name"), userDetails.getUsername());

        // Tag the agent with owner info via metadata
        request.put("owner_id", String.valueOf(ownerId));

        var result = agentRestClient.createAgent(request).block();
        if (result != null && result.get("id") != null) {
            var agentId = String.valueOf(result.get("id"));
            // 归属持久化：重启/多实例后依然可校验
            agentOwnershipRepository.save(new AgentOwnership(agentId, ownerId, null));
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 列出当前用户拥有的 Agent（data 为 JSON 数组，且只包含自己的 Agent）。
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AgentResponse>>> listAgents(
            @RequestParam(required = false) String agentType,
            @RequestParam(required = false) String statusFilter,
            @AuthenticationPrincipal UserDetails userDetails) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        log.debug("Listing agents: agentType={}, statusFilter={}, user={}",
                agentType, statusFilter, userDetails.getUsername());

        var ownedAgentIds = ownedAgentIds(userId);
        var result = agentRestClient.listAgents(agentType, statusFilter).block();

        var agents = new ArrayList<AgentResponse>();
        if (result != null) {
            for (var raw : result) {
                var agentId = raw.get("id") == null ? null : String.valueOf(raw.get("id"));
                if (agentId != null && ownedAgentIds.contains(agentId)) {
                    agents.add(toAgentResponse(raw));
                }
            }
        }
        return ResponseEntity.ok(ApiResponse.success(agents));
    }

    @GetMapping("/{agentId}")
    public ResponseEntity<ApiResponse<AgentResponse>> getAgent(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getAgent(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(toAgentResponse(result)));
    }

    /**
     * 更新 Agent 元信息（name/description/agentType/config），需要归属校验。
     */
    @PutMapping("/{agentId}")
    public ResponseEntity<ApiResponse<AgentResponse>> updateAgent(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Updating agent: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);

        var payload = new LinkedHashMap<String, Object>();
        if (request.get("name") != null) {
            payload.put("name", request.get("name"));
        }
        if (request.get("description") != null) {
            payload.put("description", request.get("description"));
        }
        var agentType = request.get("agentType") != null ? request.get("agentType") : request.get("agent_type");
        if (agentType != null) {
            payload.put("agent_type", agentType);
        }
        if (request.get("config") != null) {
            payload.put("config", request.get("config"));
        }

        var updated = agentRestClient.updateAgent(agentId, payload).block();
        return ResponseEntity.ok(ApiResponse.success(
                toAgentResponse(updated), "Agent updated successfully"));
    }

    /**
     * 读取 Agent 配置（需要归属校验）。
     */
    @GetMapping("/{agentId}/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAgentConfig(
            @PathVariable String agentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting agent config: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.getAgentConfig(agentId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 更新 Agent 配置（需要归属校验）。
     */
    @PutMapping("/{agentId}/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateAgentConfig(
            @PathVariable String agentId,
            @RequestBody Map<String, Object> config,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Updating agent config: agentId={}, user={}", agentId, userDetails.getUsername());
        verifyAgentOwnership(agentId, userDetails);
        var result = agentRestClient.updateAgentConfig(agentId, config).block();
        return ResponseEntity.ok(ApiResponse.success(result, "Agent config updated successfully"));
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
    public ResponseEntity<ApiResponse<Object>> getMessages(
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
        agentOwnershipRepository.findByAgentId(agentId).ifPresent(agentOwnershipRepository::delete);
        return ResponseEntity.ok(ApiResponse.success(null, "Agent deleted successfully"));
    }

    /**
     * 校验当前用户是否拥有该 Agent。
     *
     * <p>fail-closed：查不到归属记录时直接拒绝，而不是放行。历史上放行是为了兼容
     * 进程重启前创建的 Agent，但归属表已持久化，这种放行只会变成越权漏洞。</p>
     */
    private void verifyAgentOwnership(String agentId, UserDetails userDetails) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        if (!agentOwnershipRepository.existsByAgentIdAndOwnerId(agentId, userId)) {
            log.warn("Access denied: user {} does not own agent {}", userId, agentId);
            throw new BusinessException("Access denied: you do not own this agent");
        }
    }

    private Set<String> ownedAgentIds(Long userId) {
        return agentOwnershipRepository.findByOwnerId(userId).stream()
                .map(AgentOwnership::getAgentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private AgentResponse toAgentResponse(Map<String, Object> agent) {
        if (agent == null) {
            return null;
        }
        var agentType = agent.get("agent_type") != null ? agent.get("agent_type") : agent.get("agentType");
        return new AgentResponse(
                asString(agent.get("id")),
                asString(agent.get("name")),
                asString(agent.get("description")),
                asString(agentType),
                asString(agent.get("status")),
                asMap(agent.get("config")),
                asString(agent.get("owner_id")),
                asString(agent.get("created_at")),
                asString(agent.get("updated_at"))
        );
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
    }

    private Long extractLong(Object value) {
        if (value instanceof Number num) {
            return num.longValue();
        }
        return null;
    }
}
