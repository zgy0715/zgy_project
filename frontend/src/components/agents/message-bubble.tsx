'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={cn(
        'flex gap-3 animate-slide-up',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm',
          isUser
            ? 'bg-brand-600 text-white'
            : isSystem
            ? 'bg-surface-3 text-zinc-400'
            : 'bg-surface-2 text-zinc-300'
        )}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-4 py-3',
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-surface-1 border border-surface-3 text-zinc-200'
        )}
      >
        {/* Render message content with code block support */}
        <MessageContent content={message.content} isUser={isUser} />

        {/* Timestamp */}
        <p
          className={cn(
            'text-xs mt-1.5',
            isUser ? 'text-brand-200' : 'text-zinc-500'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// Simple message content renderer with code block detection
function MessageContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  // Split content by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm leading-relaxed space-y-2">
      {parts.map((part, index) => {
        // Code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const language = lines[0]?.trim() || 'text';
          const code = lines.slice(1).join('\n');

          return (
            <div key={index} className="rounded-lg overflow-hidden">
              <div className="bg-surface-0 px-3 py-1.5 text-xs text-zinc-400 border-b border-surface-3 flex items-center justify-between">
                <span>{language}</span>
                <button className="text-zinc-500 hover:text-white transition-colors">
                  Copy
                </button>
              </div>
              <pre className="bg-surface-0 p-3 overflow-x-auto scrollbar-thin">
                <code className="text-xs text-zinc-300 font-mono">{code}</code>
              </pre>
            </div>
          );
        }

        // Inline code
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={index}>
            {inlineParts.map((inlinePart, i) => {
              if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
                return (
                  <code
                    key={i}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-mono',
                      isUser
                        ? 'bg-brand-700 text-brand-100'
                        : 'bg-surface-2 text-brand-400'
                    )}
                  >
                    {inlinePart.slice(1, -1)}
                  </code>
                );
              }
              return <span key={i}>{inlinePart}</span>;
            })}
          </span>
        );
      })}
    </div>
  );
}
