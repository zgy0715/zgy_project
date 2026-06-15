package com.deepagent.orchestrator.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.client.AgentRestClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
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

import java.util.Map;

/**
 * REST controller for workflow management and execution endpoints.
 *
 * <p>All endpoints require JWT authentication.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final AgentRestClient agentRestClient;

    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createWorkflow(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Creating workflow: name={}, user={}", request.get("name"), userDetails.getUsername());
        var result = agentRestClient.createWorkflow(request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map>> listWorkflows(
            @RequestParam(required = false) String statusFilter,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Listing workflows: statusFilter={}, user={}", statusFilter, userDetails.getUsername());
        var result = agentRestClient.listWorkflows(statusFilter).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<Map>> getWorkflow(
            @PathVariable String workflowId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.debug("Getting workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        var result = agentRestClient.getWorkflow(workflowId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/{workflowId}/execute")
    public ResponseEntity<ApiResponse<Map>> executeWorkflow(
            @PathVariable String workflowId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Executing workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        var result = agentRestClient.executeWorkflow(workflowId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<Void>> deleteWorkflow(
            @PathVariable String workflowId,
            @AuthenticationPrincipal UserDetails userDetails) {
        log.info("Deleting workflow: workflowId={}, user={}", workflowId, userDetails.getUsername());
        agentRestClient.deleteWorkflow(workflowId).block();
        return ResponseEntity.ok(ApiResponse.success(null, "Workflow deleted successfully"));
    }
}
