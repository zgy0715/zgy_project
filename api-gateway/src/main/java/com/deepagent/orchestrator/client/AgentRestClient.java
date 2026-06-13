package com.deepagent.orchestrator.client;

import com.deepagent.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

/**
 * REST client for communicating with the Python Agent Runtime via HTTP.
 *
 * <p>This client serves as a practical alternative to gRPC for development
 * and environments where protoc compilation is not yet available. It uses
 * Spring WebClient to make reactive HTTP calls to the Python FastAPI
 * endpoints running on localhost:8000 by default.</p>
 *
 * <p>Endpoint mapping:</p>
 * <ul>
 *   <li>POST   /api/v1/agents/             - createAgent</li>
 *   <li>GET    /api/v1/agents/             - listAgents</li>
 *   <li>GET    /api/v1/agents/{agentId}    - getAgent</li>
 *   <li>POST   /api/v1/agents/{agentId}/execute - executeAgent</li>
 *   <li>POST   /api/v1/agents/{agentId}/chat - chatWithAgent</li>
 *   <li>POST   /api/v1/agents/{agentId}/chat/stream - streamChat</li>
 *   <li>GET    /api/v1/agents/{agentId}/thinking-chain - getThinkingChain</li>
 *   <li>GET    /api/v1/agents/{agentId}/messages - getMessages</li>
 *   <li>GET    /api/v1/agents/{agentId}/review-findings - getReviewFindings</li>
 *   <li>DELETE /api/v1/agents/{agentId}    - deleteAgent</li>
 *   <li>POST   /api/v1/workflows/          - createWorkflow</li>
 *   <li>GET    /api/v1/workflows/          - listWorkflows</li>
 *   <li>GET    /api/v1/workflows/{id}      - getWorkflow</li>
 *   <li>POST   /api/v1/workflows/{id}/execute - executeWorkflow</li>
 *   <li>DELETE /api/v1/workflows/{id}      - deleteWorkflow</li>
 * </ul>
 */
@Slf4j
@Component
public class AgentRestClient {

    private final WebClient webClient;

    public AgentRestClient(
            @Value("${agent-runtime.url:http://localhost:8000}") String baseUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .build();
        log.info("AgentRestClient initialized with base URL: {}", baseUrl);
    }

    // --- Agent Operations ---

    /**
     * Creates a new agent instance in the Python runtime.
     *
     * @param request the agent creation request body
     * @return the created agent details
     */
    public Mono<Map> createAgent(Map<String, Object> request) {
        log.debug("Creating agent via Python runtime");
        return webClient.post()
                .uri("/api/v1/agents/")
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to create agent: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    /**
     * Lists all agents with optional type and status filters.
     *
     * @param agentType    optional agent type filter
     * @param statusFilter optional status filter
     * @return list of agent maps
     */
    public Mono<Map> listAgents(String agentType, String statusFilter) {
        log.debug("Listing agents from Python runtime");
        var uriSpec = webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/api/v1/agents/");
                    if (agentType != null) {
                        builder.queryParam("agent_type", agentType);
                    }
                    if (statusFilter != null) {
                        builder.queryParam("status_filter", statusFilter);
                    }
                    return builder.build();
                });
        return uriSpec.retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to list agents: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Gets the state of a specific agent.
     *
     * @param agentId the agent identifier
     * @return the agent state details
     */
    public Mono<Map> getAgent(String agentId) {
        log.debug("Getting agent state: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Agent service error: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Executes a task on the specified agent.
     *
     * @param agentId the agent identifier
     * @param request the execution request body
     * @return the execution result
     */
    public Mono<Map> executeAgent(String agentId, Map<String, Object> request) {
        log.debug("Executing agent task: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/execute", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Agent execution failed: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofMinutes(5));
    }

    /**
     * Sends a chat message to an agent and returns the response.
     *
     * <p>Uses the agent execute endpoint with a chat-oriented payload.
     * The Python runtime processes the task and returns the agent's response.</p>
     *
     * @param agentId the agent identifier
     * @param request the chat request body
     * @return the chat response
     */
    public Mono<Map> chatWithAgent(String agentId, Map<String, Object> request) {
        log.debug("Chatting with agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/chat", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Agent chat failed: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofMinutes(5));
    }

    /**
     * Streams chat responses from an agent using server-sent events.
     *
     * <p>Connects to the Python runtime's streaming endpoint and returns
     * a Flux of response chunks for real-time output.</p>
     *
     * @param agentId the agent identifier
     * @param request the chat request body
     * @return a flux of response chunks
     */
    public Flux<Map> streamChat(String agentId, Map<String, Object> request) {
        log.debug("Streaming chat with agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/chat/stream", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Agent stream failed: " + body))))
                .bodyToFlux(new ParameterizedTypeReference<>() {})
                .timeout(Duration.ofMinutes(10));
    }

    /**
     * Deletes an agent from the Python runtime.
     *
     * @param agentId the agent identifier
     * @return a mono that completes when deletion is done
     */
    public Mono<Void> deleteAgent(String agentId) {
        log.debug("Deleting agent: agentId={}", agentId);
        return webClient.delete()
                .uri("/api/v1/agents/{agentId}", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to delete agent: " + body))))
                .bodyToMono(Void.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Gets the thinking chain for an agent.
     */
    public Mono<Map> getThinkingChain(String agentId) {
        log.debug("Getting thinking chain: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/thinking-chain", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to get thinking chain: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Gets the message history for an agent.
     */
    public Mono<Map> getMessages(String agentId, Integer limit, Integer offset) {
        log.debug("Getting messages: agentId={}", agentId);
        var uriSpec = webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/api/v1/agents/{agentId}/messages");
                    if (limit != null) {
                        builder.queryParam("limit", limit);
                    }
                    if (offset != null) {
                        builder.queryParam("offset", offset);
                    }
                    return builder.build(agentId);
                });
        return uriSpec.retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to get messages: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Gets the review findings for an agent.
     */
    public Mono<Map> getReviewFindings(String agentId) {
        log.debug("Getting review findings: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/review-findings", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Agent not found: " + agentId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to get review findings: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    // --- Workflow Operations ---

    /**
     * Creates a new workflow in the Python runtime.
     *
     * @param request the workflow creation request body
     * @return the created workflow details
     */
    public Mono<Map> createWorkflow(Map<String, Object> request) {
        log.debug("Creating workflow via Python runtime");
        return webClient.post()
                .uri("/api/v1/workflows/")
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to create workflow: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    /**
     * Lists all workflows with optional status filter.
     *
     * @param statusFilter optional status filter
     * @return list of workflow maps
     */
    public Mono<Map> listWorkflows(String statusFilter) {
        log.debug("Listing workflows from Python runtime");
        var uriSpec = webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/api/v1/workflows/");
                    if (statusFilter != null) {
                        builder.queryParam("status_filter", statusFilter);
                    }
                    return builder.build();
                });
        return uriSpec.retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to list workflows: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Gets a workflow by ID.
     *
     * @param workflowId the workflow identifier
     * @return the workflow details
     */
    public Mono<Map> getWorkflow(String workflowId) {
        log.debug("Getting workflow: workflowId={}", workflowId);
        return webClient.get()
                .uri("/api/v1/workflows/{workflowId}", workflowId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Workflow not found: " + workflowId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Workflow service error: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * Executes a workflow with the given input task.
     *
     * @param workflowId the workflow identifier
     * @param request    the execution request body
     * @return the execution result
     */
    public Mono<Map> executeWorkflow(String workflowId, Map<String, Object> request) {
        log.debug("Executing workflow: workflowId={}", workflowId);
        return webClient.post()
                .uri("/api/v1/workflows/{workflowId}/execute", workflowId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Workflow not found: " + workflowId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Workflow execution failed: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofMinutes(10));
    }

    /**
     * Deletes a workflow from the Python runtime.
     *
     * @param workflowId the workflow identifier
     * @return a mono that completes when deletion is done
     */
    public Mono<Void> deleteWorkflow(String workflowId) {
        log.debug("Deleting workflow: workflowId={}", workflowId);
        return webClient.delete()
                .uri("/api/v1/workflows/{workflowId}", workflowId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        Mono.error(new BusinessException("Workflow not found: " + workflowId)))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Failed to delete workflow: " + body))))
                .bodyToMono(Void.class)
                .timeout(Duration.ofSeconds(15));
    }
}
