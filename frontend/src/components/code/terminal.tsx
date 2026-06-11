'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  className?: string;
  projectId: string;
}

// Embedded terminal component using xterm.js
// This is a skeleton that would be connected to a WebSocket terminal backend
export function Terminal({ className, projectId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  type LineType = 'system' | 'prompt' | 'output' | 'error';

  const placeholderLines: { type: LineType; text: string }[] = [
    { type: 'system', text: `DeepAgent Terminal - Project: ${projectId}` },
    { type: 'system', text: 'Type "help" for available commands.' },
    { type: 'prompt', text: '$ ' },
  ];

  useEffect(() => {
    // In a real implementation, initialize xterm.js here:
    // const term = new Terminal({ ... });
    // const fitAddon = new FitAddon();
    // term.loadAddon(fitAddon);
    // term.open(terminalRef.current!);
    // fitAddon.fit();
    // Connect to WebSocket terminal backend
    // wsClient.getSocket()?.on('terminal_output', (data) => term.write(data));

    // Scroll to bottom
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [projectId]);

  return (
    <div
      ref={terminalRef}
      className={cn(
        'bg-surface-0 rounded-xl border border-surface-3 overflow-hidden',
        className
      )}
    >
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-1 border-b border-surface-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-zinc-500 ml-2">Terminal</span>
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        className="p-4 font-mono text-sm h-64 overflow-y-auto scrollbar-thin"
      >
        {placeholderLines.map((line, index) => (
          <div key={index} className="leading-relaxed">
            {line.type === 'system' && (
              <span className="text-zinc-500">{line.text}</span>
            )}
            {line.type === 'prompt' && (
              <span className="text-green-400">{line.text}</span>
            )}
            {line.type === 'output' && (
              <span className="text-zinc-300">{line.text}</span>
            )}
            {line.type === 'error' && (
              <span className="text-red-400">{line.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
