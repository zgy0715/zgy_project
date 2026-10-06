package com.deepagent.orchestrator.client;

import com.deepagent.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * REST client for communicating with the Python Agent Runtime via HTTP.
 *
 * <p>All requests include the internal API key header for agent runtime authentication.</p>
 *
 * <p>错误映射：404 映射为 “&lt;资源&gt; not found: &lt;id&gt;”，其它 4xx 映射为上游拒绝，
 * 5xx 映射为上游故障，并保留上游返回的响应体，便于排障。</p>
 */
@Slf4j
@Component
public class AgentRestClient {

    private static final String INTERNAL_KEY_HEADER = "X-DeepAgent-Internal-Key";

    private final WebClient webClient;
    private final String internalApiKey;

    public AgentRestClient(
            @Value("${agent-runtime.url:http://localhost:8000}") String baseUrl,
            @Value("${agent-runtime.internal-api-key:}") String internalApiKey) {
        this.internalApiKey = internalApiKey == null ? "" : internalApiKey;
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(INTERNAL_KEY_HEADER, this.internalApiKey)
                .build();
        if (this.internalApiKey.isEmpty()) {
            log.warn("AgentRestClient initialized with base URL: {} but agent-runtime.internal-api-key is EMPTY: "
                    + "requests to agent-runtime will be unauthenticated (set AGENT_RUNTIME_INTERNAL_API_KEY)", baseUrl);
        } else {
            log.info("AgentRestClient initialized with base URL: {} (internal auth enabled)", baseUrl);
        }
    }

    // --- Agent Operations ---

    public Mono<Map> createAgent(Map<String, Object> request) {
        log.debug("Creating agent via Python runtime");
        return webClient.post()
                .uri("/api/v1/agents/")
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", null, "Create agent"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    /**
     * agent-runtime 的列表接口返回 JSON 数组，因此这里必须按 List 解析
     * （此前按 Map 解析会在运行时抛 DecodingException）。
     */
    public Mono<List<Map>> listAgents(String agentType, String statusFilter) {
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
                        mapUpstreamError(response, "Agent", null, "List agents"))
                .bodyToMono(new ParameterizedTypeReference<List<Map>>() { })
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Map> getAgent(String agentId) {
        log.debug("Getting agent state: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Get agent"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * 更新 Agent 元信息（agent-runtime PUT /api/v1/agents/{agentId}）。
     */
    public Mono<Map> updateAgent(String agentId, Map<String, Object> request) {
        log.debug("Updating agent: agentId={}", agentId);
        return webClient.put()
                .uri("/api/v1/agents/{agentId}", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Update agent"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    /**
     * 读取 Agent 配置（agent-runtime GET /api/v1/agents/{agentId}/config）。
     */
    public Mono<Map> getAgentConfig(String agentId) {
        log.debug("Getting agent config: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/config", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Get agent config"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * 更新 Agent 配置（agent-runtime PUT /api/v1/agents/{agentId}/config）。
     */
    public Mono<Map> updateAgentConfig(String agentId, Map<String, Object> config) {
        log.debug("Updating agent config: agentId={}", agentId);
        return webClient.put()
                .uri("/api/v1/agents/{agentId}/config", agentId)
                .bodyValue(config)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Update agent config"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    public Mono<Map> executeAgent(String agentId, Map<String, Object> request) {
        log.debug("Executing agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/execute", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Execute agent"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofMinutes(10));
    }

    public Mono<Map> chatWithAgent(String agentId, Map<String, Object> request) {
        log.debug("Chatting with agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/chat", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Chat"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(60));
    }

    /**
     * SSE 流式对话。
     *
     * <p>刻意不设置整体 timeout：流式响应可能长时间持续，整体超时会中断正常会话；
     * 连接层的 idle timeout 由 Reactor Netty 默认值负责。</p>
     */
    public Flux<Map> streamChat(String agentId, Map<String, Object> request) {
        log.debug("Streaming chat with agent: agentId={}", agentId);
        return webClient.post()
                .uri("/api/v1/agents/{agentId}/chat/stream", agentId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Stream chat"))
                .bodyToFlux(Map.class);
    }

    public Mono<Map> getThinkingChain(String agentId) {
        log.debug("Getting thinking chain: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/thinking-chain", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Get thinking chain"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * 读取 Agent 消息列表。
     *
     * <p>返回类型为 {@code Object}：agent-runtime 可能返回数组或对象包装，网关原样透传，
     * 避免类型不匹配时直接 500。</p>
     */
    public Mono<Object> getMessages(String agentId, Integer limit, Integer offset) {
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
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Get messages"))
                .bodyToMono(Object.class)
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Map> getReviewFindings(String agentId) {
        log.debug("Getting review findings: agentId={}", agentId);
        return webClient.get()
                .uri("/api/v1/agents/{agentId}/review-findings", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Get review findings"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Void> deleteAgent(String agentId) {
        log.debug("Deleting agent: agentId={}", agentId);
        return webClient.delete()
                .uri("/api/v1/agents/{agentId}", agentId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Agent", agentId, "Delete agent"))
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
                        mapUpstreamError(response, "Workflow", null, "Create workflow"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    /**
     * agent-runtime 的列表接口返回 JSON 数组（此前按 Map 解析是运行时缺陷）。
     */
    public Mono<List<Map>> listWorkflows(String statusFilter) {
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
                        mapUpstreamError(response, "Workflow", null, "List workflows"))
                .bodyToMono(new ParameterizedTypeReference<List<Map>>() { })
                .timeout(Duration.ofSeconds(15));
    }

    public Mono<Map> getWorkflow(String workflowId) {
        log.debug("Getting workflow: workflowId={}", workflowId);
        return webClient.get()
                .uri("/api/v1/workflows/{workflowId}", workflowId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Workflow", workflowId, "Get workflow"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(15));
    }

    /**
     * 更新 Workflow（agent-runtime PUT /api/v1/workflows/{workflowId}）。
     */
    public Mono<Map> updateWorkflow(String workflowId, Map<String, Object> request) {
        log.debug("Updating workflow: workflowId={}", workflowId);
        return webClient.put()
                .uri("/api/v1/workflows/{workflowId}", workflowId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Workflow", workflowId, "Update workflow"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(30));
    }

    public Mono<Map> executeWorkflow(String workflowId, Map<String, Object> request) {
        log.debug("Executing workflow: workflowId={}", workflowId);
        return webClient.post()
                .uri("/api/v1/workflows/{workflowId}/execute", workflowId)
                .bodyValue(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Workflow", workflowId, "Execute workflow"))
                .bodyToMono(Map.class)
                .timeout(Duration.ofMinutes(10));
    }

    public Mono<Void> deleteWorkflow(String workflowId) {
        log.debug("Deleting workflow: workflowId={}", workflowId);
        return webClient.delete()
                .uri("/api/v1/workflows/{workflowId}", workflowId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        mapUpstreamError(response, "Workflow", workflowId, "Delete workflow"))
                .bodyToMono(Void.class)
                .timeout(Duration.ofSeconds(15));
    }

    // --- Error mapping ---

    /**
     * 把上游错误映射为带语义的 {@link BusinessException}。
     *
     * @param response   上游响应
     * @param resource   资源名词（用于 404 提示，如 "Agent"）
     * @param resourceId 资源 ID，可为 null
     * @param operation  操作描述（用于 4xx/5xx 提示）
     */
    private Mono<? extends Throwable> mapUpstreamError(
            ClientResponse response, String resource, String resourceId, String operation) {
        var status = response.statusCode();
        var suffix = resourceId == null ? "" : ": " + resourceId;
        return response.bodyToMono(String.class)
                .defaultIfEmpty("")
                .map(body -> {
                    var detail = body.isBlank() ? "" : ": " + body;
                    if (status.value() == 404) {
                        return (Throwable) new BusinessException(
                                "NOT_FOUND", resource + " not found" + suffix);
                    }
                    if (status.is4xxClientError()) {
                        return (Throwable) new BusinessException(
                                "UPSTREAM_CLIENT_ERROR",
                                operation + " rejected by agent-runtime (" + status.value() + ")" + detail);
                    }
                    return (Throwable) new BusinessException(
                            "UPSTREAM_SERVER_ERROR",
                            operation + " failed in agent-runtime (" + status.value() + ")" + detail);
                });
    }
}
