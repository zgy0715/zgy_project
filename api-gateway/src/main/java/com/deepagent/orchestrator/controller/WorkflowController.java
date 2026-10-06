package com.deepagent.orchestrator.controller;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.common.response.ApiResponse;
import com.deepagent.common.util.PrincipalUtils;
import com.deepagent.orchestrator.client.AgentRestClient;
import com.deepagent.orchestrator.dto.WorkflowResponse;
import com.deepagent.orchestrator.dto.WorkflowTemplateResponse;
import com.deepagent.orchestrator.entity.WorkflowOwnership;
import com.deepagent.orchestrator.repository.WorkflowOwnershipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * REST controller for workflow management and execution endpoints.
 *
 * <p>All endpoints require JWT authentication. Workflow 归属持久化在
 * {@code workflow_ownership} 表（V2 迁移），所有按 ID 操作的端点都做归属校验。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final AgentRestClient agentRestClient;
    private final WorkflowOwnershipRepository workflowOwnershipRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createWorkflow(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        var ownerId = PrincipalUtils.requireUserId(userDetails);
        log.info("Creating workflow: name={}, user={}", request.get("name"), userDetails.getUsername());

        request.put("owner_id", String.valueOf(ownerId));
        var result = agentRestClient.createWorkflow(request).block();
        if (result != null && result.get("id") != null) {
            var workflowId = String.valueOf(result.get("id"));
            workflowOwnershipRepository.save(new WorkflowOwnership(workflowId, ownerId, null));
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 列出当前用户拥有的 Workflow（data 为 JSON 数组）。
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<WorkflowResponse>>> listWorkflows(
            @RequestParam(required = false) String statusFilter,
            @AuthenticationPrincipal UserDetails userDetails) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        log.debug("Listing workflows: statusFilter={}, user={}", statusFilter, userDetails.getUsername());

        var ownedIds = ownedWorkflowIds(userId);
        var result = agentRestClient.listWorkflows(statusFilter).block();

        var workflows = new ArrayList<WorkflowResponse>();
        if (result != null) {
            for (var raw : result) {
                var workflowId = raw.get("id") == null ? null : String.valueOf(raw.get("id"));
                if (workflowId != null && ownedIds.contains(workflowId)) {
                    workflows.add(toWorkflowResponse(raw));
                }
            }
        }
        return ResponseEntity.ok(ApiResponse.success(workflows));
    }

    /**
     * Workflow 模板列表。
     *
     * <p>路由声明在 {@code /{workflowId}} 之前，且字面量路径优先级高于路径变量，
     * 因此不会被 {@code /{workflowId}} 抢占。</p>
     */
    @GetMapping("/templates")
    public ResponseEntity<ApiResponse<List<WorkflowTemplateResponse>>> listTemplates(
            @AuthenticationPrincipal UserDetails userDetails) {
        PrincipalUtils.requireUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.success(builtInTemplates()));
    }

    @GetMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<WorkflowResponse>> getWorkflow(
            @PathVariable String workflowId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        verifyWorkflowOwnership(workflowId, userDetails);
        var result = agentRestClient.getWorkflow(workflowId).block();
        return ResponseEntity.ok(ApiResponse.success(toWorkflowResponse(result)));
    }

    /**
     * 更新 Workflow（name/description/definition/status）。
     */
    @PutMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<WorkflowResponse>> updateWorkflow(
            @PathVariable String workflowId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Updating workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        verifyWorkflowOwnership(workflowId, userDetails);

        var payload = new LinkedHashMap<String, Object>();
        if (request.get("name") != null) {
            payload.put("name", request.get("name"));
        }
        if (request.get("description") != null) {
            payload.put("description", request.get("description"));
        }
        var definition = request.get("definition") != null ? request.get("definition") : request.get("nodes");
        if (definition != null) {
            payload.put("definition", definition);
        }
        if (request.get("edges") != null) {
            payload.put("edges", request.get("edges"));
        }
        if (request.get("status") != null) {
            payload.put("status", request.get("status"));
        }

        var updated = agentRestClient.updateWorkflow(workflowId, payload).block();
        return ResponseEntity.ok(ApiResponse.success(
                toWorkflowResponse(updated), "Workflow updated successfully"));
    }

    @PostMapping("/{workflowId}/execute")
    public ResponseEntity<ApiResponse<Map>> executeWorkflow(
            @PathVariable String workflowId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Executing workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        verifyWorkflowOwnership(workflowId, userDetails);
        var result = agentRestClient.executeWorkflow(workflowId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<Void>> deleteWorkflow(
            @PathVariable String workflowId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Deleting workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        verifyWorkflowOwnership(workflowId, userDetails);
        agentRestClient.deleteWorkflow(workflowId).block();
        workflowOwnershipRepository.findByWorkflowId(workflowId)
                .ifPresent(workflowOwnershipRepository::delete);
        return ResponseEntity.ok(ApiResponse.success(null, "Workflow deleted successfully"));
    }

    /**
     * 归属校验：查不到归属记录时拒绝（fail-closed）。
     */
    private void verifyWorkflowOwnership(String workflowId, UserDetails userDetails) {
        var userId = PrincipalUtils.requireUserId(userDetails);
        if (!workflowOwnershipRepository.existsByWorkflowIdAndOwnerId(workflowId, userId)) {
            log.warn("Access denied: user {} does not own workflow {}", userId, workflowId);
            throw new BusinessException("Access denied: you do not own this workflow");
        }
    }

    private Set<String> ownedWorkflowIds(Long userId) {
        return workflowOwnershipRepository.findByOwnerId(userId).stream()
                .map(WorkflowOwnership::getWorkflowId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private WorkflowResponse toWorkflowResponse(Map<String, Object> workflow) {
        if (workflow == null) {
            return null;
        }
        return new WorkflowResponse(
                asString(workflow.get("id")),
                asString(workflow.get("name")),
                asString(workflow.get("description")),
                asString(workflow.get("status")),
                asMapList(workflow.get("nodes")),
                asMapList(workflow.get("edges")),
                asString(workflow.get("owner_id")),
                asString(workflow.get("created_at")),
                asString(workflow.get("updated_at"))
        );
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(Map.class::isInstance)
                    .map(item -> (Map<String, Object>) item)
                    .toList();
        }
        return List.of();
    }

    /**
     * 内置模板：agent-runtime 没有模板接口，模板由网关提供。
     */
    private List<WorkflowTemplateResponse> builtInTemplates() {
        return List.of(
                new WorkflowTemplateResponse(
                        "feature-development",
                        "功能开发",
                        "需求分析 → 编码 → 代码审查 → 测试",
                        "development",
                        Map.of(
                                "nodes", List.of(
                                        Map.of("id", "analyst", "agent_type", "analyst", "name", "需求分析"),
                                        Map.of("id", "coder", "agent_type", "coder", "name", "编码"),
                                        Map.of("id", "reviewer", "agent_type", "reviewer", "name", "代码审查"),
                                        Map.of("id", "tester", "agent_type", "tester", "name", "测试")),
                                "edges", List.of(
                                        Map.of("from", "analyst", "to", "coder"),
                                        Map.of("from", "coder", "to", "reviewer"),
                                        Map.of("from", "reviewer", "to", "tester")))),
                new WorkflowTemplateResponse(
                        "bug-fix",
                        "缺陷修复",
                        "缺陷定位 → 修复 → 回归验证",
                        "maintenance",
                        Map.of(
                                "nodes", List.of(
                                        Map.of("id", "debugger", "agent_type", "debugger", "name", "缺陷定位"),
                                        Map.of("id", "coder", "agent_type", "coder", "name", "修复"),
                                        Map.of("id", "tester", "agent_type", "tester", "name", "回归验证")),
                                "edges", List.of(
                                        Map.of("from", "debugger", "to", "coder"),
                                        Map.of("from", "coder", "to", "tester")))),
                new WorkflowTemplateResponse(
                        "code-review",
                        "代码审查",
                        "静态审查 + 安全性检查",
                        "quality",
                        Map.of(
                                "nodes", List.of(
                                        Map.of("id", "reviewer", "agent_type", "reviewer", "name", "代码审查"),
                                        Map.of("id", "security", "agent_type", "security", "name", "安全检查")),
                                "edges", List.of(Map.of("from", "reviewer", "to", "security"))))
        );
    }
}
