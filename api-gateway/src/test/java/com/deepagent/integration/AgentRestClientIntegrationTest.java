package com.deepagent.integration;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.orchestrator.client.AgentRestClient;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for AgentRestClient against a mock Python runtime.
 *
 * <p>Verifies that the Java gateway correctly proxies requests to the
 * Python backend by checking:</p>
 * <ul>
 *   <li>Correct HTTP methods (GET, POST, DELETE)</li>
 *   <li>Correct URI paths matching the Python FastAPI routes</li>
 *   <li>Correct request body serialization</li>
 *   <li>Correct response deserialization</li>
 *   <li>Error handling for 4xx and 5xx responses</li>
 * </ul>
 */
class AgentRestClientIntegrationTest {

    private MockWebServer mockWebServer;
    private AgentRestClient agentRestClient;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();
        String baseUrl = String.format("http://localhost:%d", mockWebServer.getPort());
        agentRestClient = new AgentRestClient(baseUrl);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    // ================================================================
    // Agent CRUD Operations
    // ================================================================

    @Nested
    @DisplayName("Agent CRUD Operations")
    class AgentCrudTests {

        @Test
        @DisplayName("createAgent sends POST /api/v1/agents/ with request body")
        void createAgent_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "id": "test-coder",
                    "agent_type": "coder",
                    "name": "test-coder",
                    "description": "A test coder agent",
                    "status": "pending",
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00"
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map<String, Object> request = Map.of(
                    "name", "test-coder",
                    "agent_type", "coder",
                    "description", "A test coder agent"
            );

            Map result = agentRestClient.createAgent(request).block();

            assertNotNull(result);
            assertEquals("test-coder", result.get("id"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            assertEquals("/api/v1/agents/", recorded.getPath());
            assertTrue(recorded.getBody().readUtf8().contains("test-coder"));
        }

        @Test
        @DisplayName("listAgents sends GET /api/v1/agents/ with optional filters")
        void listAgents_sendsCorrectRequest() throws Exception {
            String responseBody = """
                [
                    {
                        "id": "agent-1",
                        "agent_type": "coder",
                        "name": "agent-1",
                        "status": "pending",
                        "created_at": "2024-01-01T00:00:00",
                        "updated_at": "2024-01-01T00:00:00"
                    }
                ]
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.listAgents("coder", "pending").block();

            assertNotNull(result);

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertTrue(recorded.getPath().startsWith("/api/v1/agents/"));
            assertTrue(recorded.getPath().contains("agent_type=coder"));
            assertTrue(recorded.getPath().contains("status_filter=pending"));
        }

        @Test
        @DisplayName("listAgents without filters sends GET /api/v1/agents/")
        void listAgents_noFilters_sendsCorrectPath() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("[]")
                    .setHeader("Content-Type", "application/json"));

            agentRestClient.listAgents(null, null).block();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertEquals("/api/v1/agents/", recorded.getPath());
        }

        @Test
        @DisplayName("getAgent sends GET /api/v1/agents/{agentId}")
        void getAgent_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "id": "my-agent",
                    "agent_type": "coder",
                    "name": "my-agent",
                    "status": "completed",
                    "messages": [],
                    "artifacts": []
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.getAgent("my-agent").block();

            assertNotNull(result);
            assertEquals("my-agent", result.get("id"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertEquals("/api/v1/agents/my-agent", recorded.getPath());
        }

        @Test
        @DisplayName("getAgent throws BusinessException for 404")
        void getAgent_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            BusinessException exception = assertThrows(BusinessException.class, () ->
                    agentRestClient.getAgent("nonexistent").block());

            assertTrue(exception.getMessage().contains("Agent not found"));
        }

        @Test
        @DisplayName("deleteAgent sends DELETE /api/v1/agents/{agentId}")
        void deleteAgent_sendsCorrectRequest() throws Exception {
            mockWebServer.enqueue(new MockResponse().setResponseCode(204));

            agentRestClient.deleteAgent("my-agent").block();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("DELETE", recorded.getMethod());
            assertEquals("/api/v1/agents/my-agent", recorded.getPath());
        }

        @Test
        @DisplayName("deleteAgent throws BusinessException for 404")
        void deleteAgent_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            assertThrows(BusinessException.class, () ->
                    agentRestClient.deleteAgent("nonexistent").block());
        }
    }

    // ================================================================
    // Agent Execution & Chat
    // ================================================================

    @Nested
    @DisplayName("Agent Execution & Chat")
    class AgentExecutionTests {

        @Test
        @DisplayName("executeAgent sends POST /api/v1/agents/{agentId}/execute")
        void executeAgent_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "agent_id": "exec-agent",
                    "status": "completed",
                    "result": "Task completed successfully",
                    "artifacts": [],
                    "error": null
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map<String, Object> request = Map.of(
                    "task", "Write a hello world function",
                    "context", Map.of("language", "python")
            );

            Map result = agentRestClient.executeAgent("exec-agent", request).block();

            assertNotNull(result);
            assertEquals("completed", result.get("status"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            assertEquals("/api/v1/agents/exec-agent/execute", recorded.getPath());
        }

        @Test
        @DisplayName("chatWithAgent sends POST /api/v1/agents/{agentId}/chat (not /execute)")
        void chatWithAgent_sendsCorrectUri() throws Exception {
            String responseBody = """
                {
                    "agent_id": "chat-agent",
                    "message": {"role": "assistant", "content": "Hello!"},
                    "thinking_chain": null,
                    "status": "completed"
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map<String, Object> request = Map.of("message", "Hello, can you help me?");

            Map result = agentRestClient.chatWithAgent("chat-agent", request).block();

            assertNotNull(result);

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            // Verify the URI is /chat, NOT /execute
            assertEquals("/api/v1/agents/chat-agent/chat", recorded.getPath());
        }

        @Test
        @DisplayName("streamChat sends POST /api/v1/agents/{agentId}/chat/stream")
        void streamChat_sendsCorrectUri() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("data: {\"type\":\"chunk\",\"data\":{\"content\":\"Hello\"}}\n\n")
                    .setHeader("Content-Type", "text/event-stream"));

            Map<String, Object> request = Map.of("message", "Stream this");

            // streamChat returns a Flux; take the first element
            Map result = agentRestClient.streamChat("stream-agent", request)
                    .blockFirst();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            // Verify the URI is /chat/stream
            assertEquals("/api/v1/agents/stream-agent/chat/stream", recorded.getPath());
        }

        @Test
        @DisplayName("executeAgent throws BusinessException for 404")
        void executeAgent_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            Map<String, Object> request = Map.of("task", "Do something");

            assertThrows(BusinessException.class, () ->
                    agentRestClient.executeAgent("nonexistent", request).block());
        }
    }

    // ================================================================
    // Thinking Chain, Messages, Review Findings
    // ================================================================

    @Nested
    @DisplayName("Agent Query Endpoints")
    class AgentQueryTests {

        @Test
        @DisplayName("getThinkingChain sends GET /api/v1/agents/{agentId}/thinking-chain")
        void getThinkingChain_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "agent_id": "think-agent",
                    "agent_type": "coder",
                    "steps": [
                        {"step": "plan", "thought": "Analyzing task", "timestamp": "2024-01-01T00:00:00"}
                    ],
                    "total_steps": 1
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.getThinkingChain("think-agent").block();

            assertNotNull(result);
            assertEquals("think-agent", result.get("agent_id"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertEquals("/api/v1/agents/think-agent/thinking-chain", recorded.getPath());
        }

        @Test
        @DisplayName("getMessages sends GET /api/v1/agents/{agentId}/messages with pagination")
        void getMessages_sendsCorrectRequest() throws Exception {
            String responseBody = """
                [
                    {"role": "user", "content": "Hello", "agent_id": "msg-agent"},
                    {"role": "assistant", "content": "Hi there!", "agent_id": "msg-agent"}
                ]
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.getMessages("msg-agent", 10, 0).block();

            assertNotNull(result);

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertTrue(recorded.getPath().startsWith("/api/v1/agents/msg-agent/messages"));
            assertTrue(recorded.getPath().contains("limit=10"));
            assertTrue(recorded.getPath().contains("offset=0"));
        }

        @Test
        @DisplayName("getMessages without pagination sends GET without query params")
        void getMessages_noPagination_sendsCorrectPath() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("[]")
                    .setHeader("Content-Type", "application/json"));

            agentRestClient.getMessages("msg-agent", null, null).block();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("/api/v1/agents/msg-agent/messages", recorded.getPath());
        }

        @Test
        @DisplayName("getReviewFindings sends GET /api/v1/agents/{agentId}/review-findings")
        void getReviewFindings_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "findings": [
                        {
                            "category": "warning",
                            "title": "Missing error handling",
                            "description": "The function lacks try-catch",
                            "location": "src/main.py:42",
                            "suggestion": "Add try-except block"
                        }
                    ],
                    "summary": "1 warning found",
                    "approved": false
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.getReviewFindings("review-agent").block();

            assertNotNull(result);

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertEquals("/api/v1/agents/review-agent/review-findings", recorded.getPath());
        }

        @Test
        @DisplayName("getThinkingChain throws BusinessException for 404")
        void getThinkingChain_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            assertThrows(BusinessException.class, () ->
                    agentRestClient.getThinkingChain("nonexistent").block());
        }
    }

    // ================================================================
    // Workflow Operations
    // ================================================================

    @Nested
    @DisplayName("Workflow Operations")
    class WorkflowTests {

        @Test
        @DisplayName("createWorkflow sends POST /api/v1/workflows/ with request body")
        void createWorkflow_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "id": "wf-123",
                    "name": "test-workflow",
                    "description": "A test workflow",
                    "status": "created",
                    "nodes": [
                        {"id": "coder-1", "agent_type": "coder", "name": "Coder"}
                    ],
                    "edges": [],
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00"
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map<String, Object> request = Map.of(
                    "name", "test-workflow",
                    "description", "A test workflow",
                    "nodes", java.util.List.of(
                            Map.of("id", "coder-1", "agent_type", "coder", "name", "Coder")
                    ),
                    "edges", java.util.List.of()
            );

            Map result = agentRestClient.createWorkflow(request).block();

            assertNotNull(result);
            assertEquals("wf-123", result.get("id"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            assertEquals("/api/v1/workflows/", recorded.getPath());
        }

        @Test
        @DisplayName("listWorkflows sends GET /api/v1/workflows/ with optional filter")
        void listWorkflows_sendsCorrectRequest() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("[]")
                    .setHeader("Content-Type", "application/json"));

            agentRestClient.listWorkflows("created").block();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertTrue(recorded.getPath().startsWith("/api/v1/workflows/"));
            assertTrue(recorded.getPath().contains("status_filter=created"));
        }

        @Test
        @DisplayName("getWorkflow sends GET /api/v1/workflows/{workflowId}")
        void getWorkflow_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "id": "wf-456",
                    "name": "my-workflow",
                    "status": "created",
                    "nodes": [],
                    "edges": [],
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00"
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map result = agentRestClient.getWorkflow("wf-456").block();

            assertNotNull(result);
            assertEquals("wf-456", result.get("id"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("GET", recorded.getMethod());
            assertEquals("/api/v1/workflows/wf-456", recorded.getPath());
        }

        @Test
        @DisplayName("executeWorkflow sends POST /api/v1/workflows/{workflowId}/execute")
        void executeWorkflow_sendsCorrectRequest() throws Exception {
            String responseBody = """
                {
                    "workflow_id": "wf-789",
                    "status": "completed",
                    "results": {"code_output": "done"},
                    "error": null
                }
                """;
            mockWebServer.enqueue(new MockResponse()
                    .setBody(responseBody)
                    .setHeader("Content-Type", "application/json"));

            Map<String, Object> request = Map.of(
                    "input_task", "Write a function",
                    "context", Map.of()
            );

            Map result = agentRestClient.executeWorkflow("wf-789", request).block();

            assertNotNull(result);
            assertEquals("completed", result.get("status"));

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("POST", recorded.getMethod());
            assertEquals("/api/v1/workflows/wf-789/execute", recorded.getPath());
        }

        @Test
        @DisplayName("deleteWorkflow sends DELETE /api/v1/workflows/{workflowId}")
        void deleteWorkflow_sendsCorrectRequest() throws Exception {
            mockWebServer.enqueue(new MockResponse().setResponseCode(204));

            agentRestClient.deleteWorkflow("wf-delete").block();

            RecordedRequest recorded = mockWebServer.takeRequest();
            assertEquals("DELETE", recorded.getMethod());
            assertEquals("/api/v1/workflows/wf-delete", recorded.getPath());
        }

        @Test
        @DisplayName("getWorkflow throws BusinessException for 404")
        void getWorkflow_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            assertThrows(BusinessException.class, () ->
                    agentRestClient.getWorkflow("nonexistent").block());
        }

        @Test
        @DisplayName("executeWorkflow throws BusinessException for 404")
        void executeWorkflow_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            Map<String, Object> request = Map.of("input_task", "Do something");

            assertThrows(BusinessException.class, () ->
                    agentRestClient.executeWorkflow("nonexistent", request).block());
        }

        @Test
        @DisplayName("deleteWorkflow throws BusinessException for 404")
        void deleteWorkflow_notFound_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(404));

            assertThrows(BusinessException.class, () ->
                    agentRestClient.deleteWorkflow("nonexistent").block());
        }
    }

    // ================================================================
    // Error Handling Tests
    // ================================================================

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("5xx server errors throw BusinessException")
        void serverError_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(500)
                    .setBody("Internal Server Error"));

            assertThrows(BusinessException.class, () ->
                    agentRestClient.listAgents(null, null).block());
        }

        @Test
        @DisplayName("createAgent 4xx error throws BusinessException")
        void createAgent_clientError_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(400)
                    .setBody("{\"detail\":\"Invalid request\"}"));

            Map<String, Object> request = Map.of("name", "bad-agent");

            assertThrows(BusinessException.class, () ->
                    agentRestClient.createAgent(request).block());
        }

        @Test
        @DisplayName("createWorkflow 4xx error throws BusinessException")
        void createWorkflow_clientError_throwsBusinessException() {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(422)
                    .setBody("{\"detail\":\"Validation error\"}"));

            Map<String, Object> request = Map.of("name", "bad-workflow");

            assertThrows(BusinessException.class, () ->
                    agentRestClient.createWorkflow(request).block());
        }
    }
}
