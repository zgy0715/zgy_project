'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { MessageBubble } from './message-bubble';
import { AgentStatusBadge } from './agent-status';
import type { ChatMessage, Agent, ThinkingChain as ThinkingChainType } from '@/types';

// Agent type emoji map
const agentEmojiMap: Record<string, string> = {
  coder: '🧑‍💻',
  reviewer: '🔍',
  tester: '🧪',
  deployer: '🚀',
  planner: '📋',
  custom: '⚙️',
};

interface ChatPanelProps {
  messages: ChatMessage[];
  agents: Agent[];
  currentAgent: Agent | null;
  thinkingChains: ThinkingChainType[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({
  messages,
  agents,
  currentAgent,
  thinkingChains,
  isStreaming,
  onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    const maxHeight = 3 * 24; // ~3 lines
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage(trimmed);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Helper: get agent by id
  const getAgent = (agentId: string) => agents.find((a) => a.id === agentId);

  // Helper: get thinking chain for a message
  const getThinkingChain = (messageId: string) =>
    thinkingChains.find((tc) => tc.agentId === (getAgent(messageId)?.id));

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: current agent info */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-3 bg-surface-1">
        {currentAgent ? (
          <>
            <span className="text-lg">
              {agentEmojiMap[currentAgent.agentType] ?? '🤖'}
            </span>
            <span className="text-sm font-medium text-white">
              {currentAgent.name}
            </span>
            <AgentStatusBadge status={currentAgent.status} size="sm" />
            <span className="text-xs text-zinc-500 ml-auto">
              {currentAgent.model ?? ''}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg">👥</span>
            <span className="text-sm font-medium text-white">全部 Agent</span>
            <span className="text-xs text-zinc-500 ml-auto">
              多 Agent 协作
            </span>
          </>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              开始对话
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              选择一个 Agent 或使用全部 Agent 模式，发送消息开始协作
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            agent={
              message.role === 'assistant'
                ? getAgent(message.agentId ?? '')
                : undefined
            }
            thinkingChain={
              message.role === 'assistant'
                ? getThinkingChain(message.id)
                : undefined
            }
          />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner size="sm" />
            <span>Agent 正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-surface-3 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="描述你的需求，Agent 团队将协作完成..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
