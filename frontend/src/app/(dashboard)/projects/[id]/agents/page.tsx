'use client';

import { useState, useMemo } from 'react';
import { use } from 'react';
import { AgentSelector } from '@/components/agents/agent-selector';
import { ChatPanel } from '@/components/agents/chat-panel';
import { useAgentStore } from '@/stores/agent-store';

export default function AgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Zustand store
  const agents = useAgentStore((s) => s.agents);
  const messages = useAgentStore((s) => s.messages);
  const thinkingChains = useAgentStore((s) => s.thinkingChains);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const currentAgent = useAgentStore((s) => s.currentAgent);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const sendMessage = useAgentStore((s) => s.sendMessage);

  // Local state: null = "all agents" view
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    currentAgent?.id ?? null
  );

  // Filter messages based on selected agent
  const filteredMessages = useMemo(() => {
    if (selectedAgentId === null) {
      // Show all messages sorted by timestamp
      return [...messages].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }
    return messages.filter((m) => m.agentId === selectedAgentId);
  }, [messages, selectedAgentId]);

  // Get the currently selected agent object
  const activeAgent =
    selectedAgentId !== null
      ? agents.find((a) => a.id === selectedAgentId) ?? null
      : null;

  // Handle agent selection
  const handleSelectAgent = (agentId: string | null) => {
    setSelectedAgentId(agentId);
    if (agentId !== null) {
      selectAgent(agentId);
    }
  };

  // Handle send message
  const handleSendMessage = (content: string) => {
    // If "all agents" mode, send to the first agent (coder by default)
    if (selectedAgentId === null) {
      const targetAgent = agents[0];
      if (targetAgent) {
        selectAgent(targetAgent.id);
      }
    }
    sendMessage(content);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* Left panel: Agent list (280px) */}
      <div className="w-[280px] flex-shrink-0 border-r border-surface-3 bg-surface-1">
        <div className="px-3 py-3 border-b border-surface-3">
          <h2 className="text-sm font-medium text-zinc-300">Agent 列表</h2>
        </div>
        <AgentSelector
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
        />
      </div>

      {/* Right panel: Chat area (flex-1) */}
      <div className="flex-1 min-w-0 bg-surface-0">
        <ChatPanel
          messages={filteredMessages}
          agents={agents}
          currentAgent={activeAgent}
          thinkingChains={thinkingChains}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
