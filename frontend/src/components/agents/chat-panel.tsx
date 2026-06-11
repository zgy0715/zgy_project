'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { MessageBubble } from './message-bubble';
import { AgentSelector } from './agent-selector';
import type { ChatMessage, Agent } from '@/types';

interface ChatPanelProps {
  agents: Agent[];
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onSelectAgent: (agent: Agent) => void;
  currentAgent: Agent | null;
}

export function ChatPanel({
  agents,
  messages,
  isStreaming,
  onSendMessage,
  onSelectAgent,
  currentAgent,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Agent selector */}
      <div className="border-b border-surface-3 p-3">
        <AgentSelector
          agents={agents}
          currentAgent={currentAgent}
          onSelect={onSelectAgent}
        />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              Select an agent and send a message to begin collaborating on your
              project.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner size="sm" />
            <span>Agent is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-surface-3 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentAgent
                ? `Message ${currentAgent.name}...`
                : 'Select an agent first...'
            }
            disabled={!currentAgent || isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-surface-3 bg-surface-1 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!input.trim() || !currentAgent || isStreaming}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
