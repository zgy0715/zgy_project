'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThinkingChain } from './thinking-chain';
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

interface MessageBubbleProps {
  message: ChatMessage;
  agent?: Agent;
  thinkingChain?: ThinkingChainType;
}

export function MessageBubble({
  message,
  agent,
  thinkingChain,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm',
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-surface-2 text-zinc-300'
        )}
      >
        {isUser ? '👤' : (agent ? agentEmojiMap[agent.type] ?? '🤖' : '🤖')}
      </div>

      {/* Message content area */}
      <div className={cn('max-w-[80%] min-w-0', isUser ? 'items-end' : 'items-start')}>
        {/* Agent name label */}
        {!isUser && agent && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-zinc-400">
              {agent.name}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'rounded-xl px-4 py-3',
            isUser
              ? 'bg-brand-600 text-white'
              : 'bg-surface-1 border border-surface-3 text-zinc-200'
          )}
        >
          <MarkdownContent content={message.content} isUser={isUser} />
        </div>

        {/* Thinking chain (agent messages only) */}
        {!isUser && thinkingChain && (
          <div className="mt-2">
            <ThinkingChain chain={thinkingChain} />
          </div>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            'text-[11px] mt-1.5',
            isUser ? 'text-right text-zinc-500' : 'text-zinc-500'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
}

// Markdown content renderer with code block support
function MarkdownContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  return (
    <div className="text-sm leading-relaxed prose-sm">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '');
            const codeString = String(children).replace(/\n$/, '');

            // Inline code
            if (!match) {
              return (
                <code
                  className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-mono',
                    isUser
                      ? 'bg-brand-700 text-brand-100'
                      : 'bg-surface-2 text-brand-400'
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Block code — handled by pre below
            return (
              <CodeBlock language={match[1]} code={codeString} />
            );
          },
          pre({ children }) {
            // Let the code component handle rendering
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Code block with syntax highlighting and copy button
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="rounded-lg overflow-hidden my-2">
      {/* Header bar */}
      <div className="bg-surface-0 px-3 py-1.5 text-xs text-zinc-400 border-b border-surface-3 flex items-center justify-between">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '12px',
          fontSize: '12px',
          background: '#09090b',
          borderRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
