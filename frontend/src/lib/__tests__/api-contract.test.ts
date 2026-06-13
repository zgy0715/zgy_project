/**
 * API contract tests verifying frontend endpoints match Java Gateway controllers.
 *
 * Ensures that API_ENDPOINTS constants align with @RequestMapping paths
 * defined in the Spring Boot controllers:
 * - AuthController: /api/v1/auth/**
 * - ProjectController: /api/v1/projects/**
 * - AgentController: /api/v1/agents/**
 * - WorkflowController: /api/v1/workflows/**
 */

import { API_ENDPOINTS, WS_CONFIG, STOMP_TOPICS } from '../constants';

// ============================================================
// Auth Endpoint Contracts
// ============================================================

describe('API Contract: Auth endpoints match Java AuthController', () => {
  const authBase = '/auth';

  it('LOGIN endpoint matches POST /auth/login', () => {
    expect(API_ENDPOINTS.AUTH.LOGIN).toBe(`${authBase}/login`);
  });

  it('REGISTER endpoint matches POST /auth/register', () => {
    expect(API_ENDPOINTS.AUTH.REGISTER).toBe(`${authBase}/register`);
  });

  it('REFRESH endpoint matches POST /auth/refresh', () => {
    expect(API_ENDPOINTS.AUTH.REFRESH).toBe(`${authBase}/refresh`);
  });

  it('LOGOUT endpoint matches POST /auth/logout', () => {
    expect(API_ENDPOINTS.AUTH.LOGOUT).toBe(`${authBase}/logout`);
  });

  it('ME endpoint matches GET /auth/me', () => {
    expect(API_ENDPOINTS.AUTH.ME).toBe(`${authBase}/me`);
  });

  it('all auth endpoints are under /auth prefix', () => {
    const authEndpoints = Object.values(API_ENDPOINTS.AUTH);
    for (const endpoint of authEndpoints) {
      if (typeof endpoint === 'string') {
        expect(endpoint).toMatch(/^\/auth\//);
      }
    }
  });
});

// ============================================================
// Project Endpoint Contracts
// ============================================================

describe('API Contract: Project endpoints match Java ProjectController', () => {
  const projectBase = '/projects';

  it('LIST endpoint matches GET /projects', () => {
    expect(API_ENDPOINTS.PROJECTS.LIST).toBe(projectBase);
  });

  it('CREATE endpoint matches POST /projects', () => {
    expect(API_ENDPOINTS.PROJECTS.CREATE).toBe(projectBase);
  });

  it('DETAIL endpoint generates correct path for project ID', () => {
    expect(API_ENDPOINTS.PROJECTS.DETAIL('123')).toBe(`${projectBase}/123`);
  });

  it('UPDATE endpoint generates correct path for project ID', () => {
    expect(API_ENDPOINTS.PROJECTS.UPDATE('456')).toBe(`${projectBase}/456`);
  });

  it('DELETE endpoint generates correct path for project ID', () => {
    expect(API_ENDPOINTS.PROJECTS.DELETE('789')).toBe(`${projectBase}/789`);
  });

  it('FILES endpoint generates correct path for project files', () => {
    expect(API_ENDPOINTS.PROJECTS.FILES('proj-1')).toBe(`${projectBase}/proj-1/files`);
  });

  it('FILE_CONTENT endpoint generates correct nested path', () => {
    expect(API_ENDPOINTS.PROJECTS.FILE_CONTENT('proj-1', 'file-1')).toBe(
      `${projectBase}/proj-1/files/file-1`
    );
  });

  it('ACTIVITY endpoint generates correct path', () => {
    expect(API_ENDPOINTS.PROJECTS.ACTIVITY('proj-1')).toBe(
      `${projectBase}/proj-1/activity`
    );
  });

  it('all project endpoints are under /projects prefix', () => {
    const endpoints = API_ENDPOINTS.PROJECTS;
    const stringEndpoints = Object.values(endpoints).filter(
      (v): v is string => typeof v === 'string'
    );
    for (const endpoint of stringEndpoints) {
      expect(endpoint).toMatch(/^\/projects/);
    }
  });
});

// ============================================================
// Agent Endpoint Contracts
// ============================================================

describe('API Contract: Agent endpoints match Java AgentController', () => {
  const agentBase = '/agents';

  it('LIST endpoint matches GET /agents', () => {
    expect(API_ENDPOINTS.AGENTS.LIST).toBe(agentBase);
  });

  it('DETAIL endpoint generates correct path for agent ID', () => {
    expect(API_ENDPOINTS.AGENTS.DETAIL('agent-1')).toBe(`${agentBase}/agent-1`);
  });

  it('CHAT endpoint generates correct path (not /execute)', () => {
    // Java AgentRestClient.chatWithAgent uses /chat, NOT /execute
    expect(API_ENDPOINTS.AGENTS.CHAT('agent-1')).toBe(`${agentBase}/agent-1/chat`);
    expect(API_ENDPOINTS.AGENTS.CHAT('agent-1')).not.toContain('/execute');
  });

  it('CHAT_STREAM endpoint generates correct SSE path', () => {
    // Java AgentRestClient.streamChat uses /chat/stream
    expect(API_ENDPOINTS.AGENTS.CHAT_STREAM('agent-1')).toBe(
      `${agentBase}/agent-1/chat/stream`
    );
  });

  it('THINKING_CHAIN endpoint matches Java getThinkingChain path', () => {
    // Java: GET /api/v1/agents/{agentId}/thinking-chain
    expect(API_ENDPOINTS.AGENTS.THINKING_CHAIN('agent-1')).toBe(
      `${agentBase}/agent-1/thinking-chain`
    );
  });

  it('MESSAGES endpoint matches Java getMessages path', () => {
    // Java: GET /api/v1/agents/{agentId}/messages
    expect(API_ENDPOINTS.AGENTS.MESSAGES('agent-1')).toBe(
      `${agentBase}/agent-1/messages`
    );
  });

  it('REVIEW_FINDINGS endpoint matches Java getReviewFindings path', () => {
    // Java: GET /api/v1/agents/{agentId}/review-findings
    expect(API_ENDPOINTS.AGENTS.REVIEW_FINDINGS('agent-1')).toBe(
      `${agentBase}/agent-1/review-findings`
    );
  });

  it('CONFIG endpoint generates correct path', () => {
    expect(API_ENDPOINTS.AGENTS.CONFIG('agent-1')).toBe(
      `${agentBase}/agent-1/config`
    );
  });

  it('all agent endpoints are under /agents prefix', () => {
    const endpoints = API_ENDPOINTS.AGENTS;
    const stringEndpoints = Object.values(endpoints).filter(
      (v): v is string => typeof v === 'string'
    );
    for (const endpoint of stringEndpoints) {
      expect(endpoint).toMatch(/^\/agents/);
    }
  });
});

// ============================================================
// Workflow Endpoint Contracts
// ============================================================

describe('API Contract: Workflow endpoints match Java WorkflowController', () => {
  const workflowBase = '/workflows';

  it('LIST endpoint matches GET /workflows', () => {
    expect(API_ENDPOINTS.WORKFLOWS.LIST).toBe(workflowBase);
  });

  it('DETAIL endpoint generates correct path for workflow ID', () => {
    expect(API_ENDPOINTS.WORKFLOWS.DETAIL('wf-1')).toBe(`${workflowBase}/wf-1`);
  });

  it('EXECUTE endpoint matches Java executeWorkflow path', () => {
    // Java: POST /api/v1/workflows/{workflowId}/execute
    expect(API_ENDPOINTS.WORKFLOWS.EXECUTE('wf-1')).toBe(
      `${workflowBase}/wf-1/execute`
    );
  });

  it('TEMPLATES endpoint generates correct path', () => {
    expect(API_ENDPOINTS.WORKFLOWS.TEMPLATES).toBe(`${workflowBase}/templates`);
  });

  it('all workflow endpoints are under /workflows prefix', () => {
    const endpoints = API_ENDPOINTS.WORKFLOWS;
    const stringEndpoints = Object.values(endpoints).filter(
      (v): v is string => typeof v === 'string'
    );
    for (const endpoint of stringEndpoints) {
      expect(endpoint).toMatch(/^\/workflows/);
    }
  });
});

// ============================================================
// Endpoint Structure Consistency
// ============================================================

describe('API Contract: Endpoint structure consistency', () => {
  it('all endpoint paths start with /', () => {
    const allEndpoints = getAllStringEndpoints(API_ENDPOINTS);
    for (const endpoint of allEndpoints) {
      expect(endpoint.startsWith('/')).toBe(true);
    }
  });

  it('no endpoint paths contain double slashes', () => {
    const allEndpoints = getAllStringEndpoints(API_ENDPOINTS);
    for (const endpoint of allEndpoints) {
      expect(endpoint).not.toMatch(/\/{2,}/);
    }
  });

  it('no endpoint paths contain the /api/v1 prefix (added by base URL)', () => {
    // The base URL in api-client.ts already includes /api/v1
    // So individual endpoints should NOT repeat it
    const allEndpoints = getAllStringEndpoints(API_ENDPOINTS);
    for (const endpoint of allEndpoints) {
      expect(endpoint).not.toMatch(/^\/api\/v1/);
    }
  });

  it('dynamic path functions return valid paths for typical IDs', () => {
    // Test with various ID formats
    const testIds = ['1', 'abc-123', 'uuid-like-id', 'proj_test'];

    for (const id of testIds) {
      // Agent endpoints
      expect(API_ENDPOINTS.AGENTS.DETAIL(id)).toBe(`/agents/${id}`);
      expect(API_ENDPOINTS.AGENTS.CHAT(id)).toBe(`/agents/${id}/chat`);
      expect(API_ENDPOINTS.AGENTS.CHAT_STREAM(id)).toBe(`/agents/${id}/chat/stream`);
      expect(API_ENDPOINTS.AGENTS.THINKING_CHAIN(id)).toBe(`/agents/${id}/thinking-chain`);
      expect(API_ENDPOINTS.AGENTS.MESSAGES(id)).toBe(`/agents/${id}/messages`);
      expect(API_ENDPOINTS.AGENTS.REVIEW_FINDINGS(id)).toBe(`/agents/${id}/review-findings`);

      // Project endpoints
      expect(API_ENDPOINTS.PROJECTS.DETAIL(id)).toBe(`/projects/${id}`);
      expect(API_ENDPOINTS.PROJECTS.UPDATE(id)).toBe(`/projects/${id}`);
      expect(API_ENDPOINTS.PROJECTS.DELETE(id)).toBe(`/projects/${id}`);

      // Workflow endpoints
      expect(API_ENDPOINTS.WORKFLOWS.DETAIL(id)).toBe(`/workflows/${id}`);
      expect(API_ENDPOINTS.WORKFLOWS.EXECUTE(id)).toBe(`/workflows/${id}/execute`);
    }
  });
});

// ============================================================
// WebSocket Configuration Contracts
// ============================================================

describe('API Contract: WebSocket config matches Spring Boot backend', () => {
  it('WS endpoint matches Spring WebSocket config', () => {
    expect(WS_CONFIG.ENDPOINT).toBe('/ws');
  });

  it('broker prefix matches Spring SimpMessagingSupport', () => {
    expect(WS_CONFIG.BROKER_PREFIX).toBe('/topic');
  });

  it('app prefix matches Spring MessageMapping prefix', () => {
    expect(WS_CONFIG.APP_PREFIX).toBe('/app');
  });

  it('STOMP topic paths match backend broadcasting paths', () => {
    // Spring: @SendTo("/topic/project/{projectId}")
    expect(STOMP_TOPICS.PROJECT('proj-1')).toBe('/topic/project/proj-1');

    // Spring: @SendTo("/topic/project/{projectId}/task/{taskId}")
    expect(STOMP_TOPICS.TASK_OUTPUT('proj-1', 'task-1')).toBe(
      '/topic/project/proj-1/task/task-1'
    );

    // Spring: user-specific queue
    expect(STOMP_TOPICS.USER_NOTIFICATIONS).toBe('/user/queue/notifications');
  });
});

// ============================================================
// Full API Path Composition Test
// ============================================================

describe('API Contract: Full API path composition', () => {
  const baseUrl = 'http://localhost:8080/api/v1';

  it('agent chat full URL matches Java gateway path', () => {
    const fullUrl = `${baseUrl}${API_ENDPOINTS.AGENTS.CHAT('my-agent')}`;
    expect(fullUrl).toBe('http://localhost:8080/api/v1/agents/my-agent/chat');
  });

  it('agent chat stream full URL matches Java gateway path', () => {
    const fullUrl = `${baseUrl}${API_ENDPOINTS.AGENTS.CHAT_STREAM('my-agent')}`;
    expect(fullUrl).toBe('http://localhost:8080/api/v1/agents/my-agent/chat/stream');
  });

  it('workflow execute full URL matches Java gateway path', () => {
    const fullUrl = `${baseUrl}${API_ENDPOINTS.WORKFLOWS.EXECUTE('wf-1')}`;
    expect(fullUrl).toBe('http://localhost:8080/api/v1/workflows/wf-1/execute');
  });

  it('thinking chain full URL matches Java gateway path', () => {
    const fullUrl = `${baseUrl}${API_ENDPOINTS.AGENTS.THINKING_CHAIN('agent-1')}`;
    expect(fullUrl).toBe('http://localhost:8080/api/v1/agents/agent-1/thinking-chain');
  });

  it('review findings full URL matches Java gateway path', () => {
    const fullUrl = `${baseUrl}${API_ENDPOINTS.AGENTS.REVIEW_FINDINGS('agent-1')}`;
    expect(fullUrl).toBe('http://localhost:8080/api/v1/agents/agent-1/review-findings');
  });
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Recursively extracts all string endpoint values from the API_ENDPOINTS object.
 * Skips function values (dynamic path generators) since they are tested separately.
 */
function getAllStringEndpoints(obj: Record<string, unknown>): string[] {
  const results: string[] = [];

  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      results.push(value);
    } else if (typeof value === 'function') {
      // Skip dynamic path functions - they are tested with specific IDs
      continue;
    } else if (typeof value === 'object' && value !== null) {
      results.push(...getAllStringEndpoints(value as Record<string, unknown>));
    }
  }

  return results;
}
