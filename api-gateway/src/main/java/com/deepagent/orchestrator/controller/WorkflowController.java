package com.deepagent.orchestrator.controller;

import com.deepagent.common.response.ApiResponse;
import com.deepagent.orchestrator.client.AgentRestClient;
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
 * REST controller for workflow management and execution endpoints.
 *
 * <p>Provides endpoints that proxy workflow operations to the Python Agent
 * Runtime via {@link AgentRestClient}. Workflows define DAG-based agent
 * orchestration with nodes and edges.</p>
 *
 * <p>All endpoints require JWT authentication.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final AgentRestClient agentRestClient;

    /**
     * Creates a new workflow from a DAG definition.
     *
     * @param request the workflow creation request containing name, nodes, edges, etc.
     * @return the created workflow details
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map>> createWorkflow(
            @RequestBody Map<String, Object> request) {
        log.info("Creating workflow: name={}", request.get("name"));
        var result = agentRestClient.createWorkflow(request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Lists all workflows with optional filtering.
     *
     * @param statusFilter optional filter by workflow status
     * @return list of workflows
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Map>> listWorkflows(
            @RequestParam(required = false) String statusFilter) {
        log.debug("Listing workflows: statusFilter={}", statusFilter);
        var result = agentRestClient.listWorkflows(statusFilter).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Gets a workflow by ID.
     *
     * @param workflowId the workflow identifier
     * @return the workflow details
     */
    @GetMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<Map>> getWorkflow(
            @PathVariable String workflowId) {
        log.debug("Getting workflow: workflowId={}", workflowId);
        var result = agentRestClient.getWorkflow(workflowId).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Executes a workflow with the given input task.
     *
     * <p>The workflow engine orchestrates agents through the DAG defined
     * by the workflow's nodes and edges.</p>
     *
     * @param workflowId the workflow identifier
     * @param request    the execution request containing input_task and context
     * @return the execution result
     */
    @PostMapping("/{workflowId}/execute")
    public ResponseEntity<ApiResponse<Map>> executeWorkflow(
            @PathVariable String workflowId,
            @RequestBody Map<String, Object> request) {
        log.info("Executing workflow: workflowId={}", workflowId);
        var result = agentRestClient.executeWorkflow(workflowId, request).block();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Deletes a workflow.
     *
     * @param workflowId the workflow identifier
     * @return success response
     */
    @DeleteMapping("/{workflowId}")
    public ResponseEntity<ApiResponse<Void>> deleteWorkflow(
            @PathVariable String workflowId) {
        log.info("Deleting workflow: workflowId={}", workflowId);
        agentRestClient.deleteWorkflow(workflowId).block();
        return ResponseEntity.ok(ApiResponse.success(null, "Workflow deleted successfully"));
    }
}
