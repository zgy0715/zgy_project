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
 * <p>All requests include the internal API key header for agent runtime authentication.</p>
 */
@Slf4j
@Component
public class AgentRestClient {

    private final WebClient webClient;
    private final String internalApiKey;

    public AgentRestClient(
            @Value("${agent-runtime.url:http://localhost:8000}") String baseUrl,
            @Value("${agent-runtime.internal-api-key:}") String internalApiKey) {
        this.internalApiKey = internalApiKey;
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("X-DeepAgent-Internal-Key", internalApiKey)
                .build();
        log.info("AgentRestClient initialized with base URL: {} (auth: {})",
                baseUrl, internalApiKey.isEmpty() ? "DISABLED" : "enabled");
    }

    // --- Agent Operations ---

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

    public Mono<Map> executeAgent(String agentId, Map<String, Object> request) {
        log.debug("Executing agent: agentId={}", agentId);
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
                .timeout(Duration.ofMinutes(10));
    }

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
                                        "Chat failed: " + body))))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(60));
    }

    public Flux<Map> streamChat(String agentId, Map<String, Object> request) {
        log.debug("Streaming chat with agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/chat/stream", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Agent not found: " + agentId))))
                .onStatus(HttpStatusCode::is5xxServerError, response ->
                        response.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(new BusinessException(
                                        "Stream chat failed: " + body))))
                .bodyToFlux(Map.class);
    }

    public Mono<Map> getThinkingChain(String agentId) {
        log.debug("Getting thinking chain: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/thinking-chain", agentId)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Map> getMessages(String agentId, Integer limit, Integer offset) {
        log.debug("Getting messages: agentId={}", agentId);
        return webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/api/v1/agents/{agentId}/messages");
                    if (limit != null) {
                        builder.queryParam("limit", limit);
                    }
                    if (offset != null) {
                        builder.queryParam("offset", offset);
                    }
                    return builder.build(agentId);
                })
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Map> getReviewFindings(String agentId) {
        log.debug("Getting review findings: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/review-findings", agentId)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

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

    // --- Workflow Operations ---

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
