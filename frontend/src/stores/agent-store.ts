// Agent state management with Zustand - dual mode (mock/api) support

import { create } from 'zustand';
import type { Agent, ChatMessage, ThinkingChain, AgentConversation } from '@/types';
import { mockAgents, mockMessages, mockThinkingChains } from '@/lib/mock-data';
import { API_MODE } from '@/lib/constants';
import { agentsApi, streamAgentChat } from '@/lib/api-client';

const apiMode = API_MODE;

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  conversations: AgentConversation[];
  currentConversation: AgentConversation | null;
  messages: ChatMessage[];
  thinkingChains: ThinkingChain[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  selectAgent: (id: string) => void;
  fetchAgents: (projectId: string) => Promise<void>;
  setConversations: (conversations: AgentConversation[]) => void;
  setCurrentConversation: (conversation: AgentConversation | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  addThinkingChain: (chain: ThinkingChain) => void;
  fetchThinkingChain: (agentId: string) => Promise<void>;
  fetchMessages: (agentId: string, conversationId?: string) => Promise<void>;
  setStreaming: (isStreaming: boolean) => void;
  sendMessage: (content: string) => void;
  simulateAgentResponse: (messageId: string, fullContent: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Mock conversation for the initial state
const mockConversation: AgentConversation = {
  id: 'conv-1',
  agentId: 'agent-coder',
  projectId: 'proj-1',
  title: 'Product Entity Generation',
  messages: mockMessages,
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

// Predefined agent responses for simulation
const agentResponses: Record<string, string> = {
  'agent-coder': `我来为您生成代码。让我分析一下需求...

\`\`\`java
// Generated code will appear here
public class GeneratedService {
    public String process(String input) {
        return "Processed: " + input;
    }
}
\`\`\`

代码已生成完毕。如需调整，请告诉我具体需求。`,
  'agent-reviewer': `正在审查代码...

**审查结果：**

✅ 代码结构清晰
✅ 命名规范合理
⚠️ 建议添加异常处理
⚠️ 建议增加日志记录

总体评价：**通过** — 代码质量良好，建议采纳改进意见。`,
  'agent-tester': `正在生成测试用例...

\`\`\`java
@Test
void shouldProcessInputCorrectly() {
    // Given
    String input = "test";
    // When
    String result = service.process(input);
    // Then
    assertEquals("Processed: test", result);
}
\`\`\`

测试用例已生成，预估通过率 **100%**。`,
  'agent-deployer': `正在配置部署环境...

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-api
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: app
          image: ecommerce-api:latest
          ports:
            - containerPort: 8080
\`\`\`

部署配置已生成。`,
};

// In mock mode, initialize with mock data
const mockDefaults = {
  agents: mockAgents,
  currentAgent: mockAgents[0],
  conversations: [mockConversation],
  currentConversation: mockConversation,
  messages: mockMessages,
  thinkingChains: mockThinkingChains,
};

// In API mode, start empty (data will be fetched)
const apiDefaults = {
  agents: [],
  currentAgent: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  thinkingChains: [],
};

const defaults = apiMode === 'mock' ? mockDefaults : apiDefaults;

const initialState = {
  ...defaults,
  isStreaming: false,
  isLoading: false,
  error: null,
};

export const useAgentStore = create<AgentState>()((set, get) => ({
  ...initialState,

  setAgents: (agents) => set({ agents, isLoading: false }),

  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
      currentAgent:
        state.currentAgent?.id === id
          ? { ...state.currentAgent, ...updates }
          : state.currentAgent,
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      currentAgent:
        state.currentAgent?.id === id ? null : state.currentAgent,
    })),

  setCurrentAgent: (currentAgent) => set({ currentAgent }),

  selectAgent: (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;

    if (apiMode === 'mock') {
      // Mock mode: find conversation from local state
      const conversation = get().conversations.find(
        (c) => c.agentId === id
      );
      set({
        currentAgent: agent,
        currentConversation: conversation ?? null,
        messages: conversation?.messages ?? [],
      });
      return;
    }

    // API mode: set agent and fetch conversation history
    set({ currentAgent: agent, messages: [], currentConversation: null });
    get().fetchMessages(id);
  },

  fetchAgents: async (projectId) => {
    if (apiMode === 'mock') {
      // Mock mode: agents already loaded
      return;
    }

    // API mode: fetch agents from backend
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.list();
      const agents = response.data.data;
      set({
        agents,
        currentAgent: agents[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch agents';
      set({ error: message, isLoading: false });
    }
  },

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversation: (currentConversation) => set({ currentConversation }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        messages[messages.length - 1] = { ...last, content };
      }
      return { messages };
    }),

  addThinkingChain: (chain) =>
    set((state) => ({ thinkingChains: [...state.thinkingChains, chain] })),

  fetchThinkingChain: async (agentId) => {
    if (apiMode === 'mock') {
      // Mock mode: thinking chains already loaded
      return;
    }

    // API mode: fetch thinking chain from backend
    try {
      const response = await agentsApi.thinkingChain(agentId);
      set({ thinkingChains: response.data.data });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch thinking chain';
      set({ error: message });
    }
  },

  fetchMessages: async (agentId, conversationId) => {
    if (apiMode === 'mock') {
      // Mock mode: messages already loaded
      return;
    }

    // API mode: fetch messages from backend
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.messages(agentId, {
        conversationId,
      });
      set({ messages: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch messages';
      set({ error: message, isLoading: false });
    }
  },

  setStreaming: (isStreaming) => set({ isStreaming }),

  sendMessage: (content) => {
    const { currentAgent, currentConversation } = get();
    if (!currentAgent) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      agentId: currentAgent.id,
      timestamp: new Date().toISOString(),
    };

    // Create placeholder for assistant response
    const assistantMessageId = `msg-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      agentId: currentAgent.id,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
    }));

    // Set agent to planning status
    get().updateAgent(currentAgent.id, { status: 'planning' });

    if (apiMode === 'mock') {
      // Mock mode: simulate response after a short delay
      const responseContent =
        agentResponses[currentAgent.id] ??
        '我已收到您的消息，正在处理中...';

      setTimeout(() => {
        get().updateAgent(currentAgent.id, { status: 'executing' });
        get().simulateAgentResponse(assistantMessageId, responseContent);
      }, 800);
      return;
    }

    // API mode: use SSE streaming for real-time response
    streamAgentChat(
      currentAgent.id,
      {
        message: content,
        conversationId: currentConversation?.id,
      },
      {
        onStart: () => {
          get().updateAgent(currentAgent.id, { status: 'executing' });
        },
        onDelta: (fullContent) => {
          get().updateLastMessage(fullContent);
        },
        onEnd: (fullContent) => {
          get().updateLastMessage(fullContent);
          get().updateAgent(currentAgent.id, { status: 'completed' });
          set({ isStreaming: false });
        },
        onError: (errorMsg) => {
          get().updateLastMessage(`Error: ${errorMsg}`);
          get().updateAgent(currentAgent.id, { status: 'failed' });
          set({ isStreaming: false, error: errorMsg });
        },
      }
    ).catch((err) => {
      const message = (err as Error).message ?? 'Failed to send message';
      get().updateLastMessage(`Error: ${message}`);
      get().updateAgent(currentAgent.id, { status: 'failed' });
      set({ isStreaming: false, error: message });
    });
  },

  simulateAgentResponse: (messageId, fullContent) => {
    let charIndex = 0;

    const streamInterval = setInterval(() => {
      const { messages } = get();
      const targetMsg = messages.find((m) => m.id === messageId);

      if (!targetMsg || charIndex >= fullContent.length) {
        clearInterval(streamInterval);
        // Mark streaming complete
        const currentAgent = get().currentAgent;
        if (currentAgent) {
          get().updateAgent(currentAgent.id, { status: 'pending' });
        }
        set({ isStreaming: false });
        return;
      }

      // Append characters one by one (20ms per character)
      charIndex += 1;
      const partialContent = fullContent.slice(0, charIndex);
      get().updateLastMessage(partialContent);
    }, 20);
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));
