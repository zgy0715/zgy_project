'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { stompClient } from '@/lib/socket';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  projectId?: string;
  className?: string;
}

export default function Terminal({ projectId, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const currentLineRef = useRef('');

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, Monaco, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      allowProposedApi: true,
      scrollback: 1000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    // Delay fit to ensure DOM is ready
    setTimeout(() => fitAddon.fit(), 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Welcome message
    xterm.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
    xterm.writeln('\x1b[1;36m║     DeepAgent Terminal v0.1.0       ║\x1b[0m');
    xterm.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m');
    xterm.writeln('');
    xterm.writeln('\x1b[33mType commands below. Use ↑/↓ for history.\x1b[0m');
    xterm.writeln('');
    xterm.write('\x1b[32m$\x1b[0m ');

    // Handle user input
    let currentLine = '';
    let cursorPos = 0;

    xterm.onData((data) => {
      switch (data) {
        case '\r': // Enter
          xterm.writeln('');
          if (currentLine.trim()) {
            executeCommand(currentLine.trim());
            commandHistoryRef.current = [...commandHistoryRef.current, currentLine.trim()];
            historyIndexRef.current = -1;
          }
          currentLine = '';
          cursorPos = 0;
          currentLineRef.current = '';
          xterm.write('\x1b[32m$\x1b[0m ');
          break;
        case '\x7f': // Backspace
          if (cursorPos > 0) {
            currentLine = currentLine.slice(0, cursorPos - 1) + currentLine.slice(cursorPos);
            cursorPos--;
            // Rewrite line
            xterm.write('\x1b[D\x1b[P');
          }
          break;
        case '\x1b[A': // Up arrow
          // Navigate command history
          {
            const history = commandHistoryRef.current;
            if (history.length > 0) {
              const newIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
              if (newIndex !== historyIndexRef.current) {
                historyIndexRef.current = newIndex;
                const cmd = history[history.length - 1 - newIndex];
                // Clear current line and write history command
                xterm.write(`\x1b[2K\r\x1b[32m$\x1b[0m ${cmd}`);
                currentLine = cmd;
                cursorPos = cmd.length;
              }
            }
          }
          break;
        case '\x1b[B': // Down arrow
          {
            const history = commandHistoryRef.current;
            if (historyIndexRef.current > 0) {
              historyIndexRef.current--;
              const cmd = history[history.length - 1 - historyIndexRef.current];
              xterm.write(`\x1b[2K\r\x1b[32m$\x1b[0m ${cmd}`);
              currentLine = cmd;
              cursorPos = cmd.length;
            } else if (historyIndexRef.current === 0) {
              historyIndexRef.current = -1;
              xterm.write('\x1b[2K\r\x1b[32m$\x1b[0m ');
              currentLine = '';
              cursorPos = 0;
            }
          }
          break;
        case '\x1b[C': // Right arrow
          if (cursorPos < currentLine.length) {
            cursorPos++;
            xterm.write(data);
          }
          break;
        case '\x1b[D': // Left arrow
          if (cursorPos > 0) {
            cursorPos--;
            xterm.write(data);
          }
          break;
        case '\x03': // Ctrl+C
          xterm.writeln('^C');
          currentLine = '';
          cursorPos = 0;
          xterm.write('\x1b[32m$\x1b[0m ');
          break;
        case '\x0c': // Ctrl+L (clear)
          xterm.clear();
          xterm.write('\x1b[32m$\x1b[0m ');
          break;
        default:
          if (data >= ' ' || data === '\t') {
            currentLine = currentLine.slice(0, cursorPos) + data + currentLine.slice(cursorPos);
            cursorPos++;
            // Rewrite from cursor position to handle mid-line insertion
            if (cursorPos < currentLine.length) {
              xterm.write(data + currentLine.slice(cursorPos));
              // Move cursor back to insertion point
              const moveBack = currentLine.length - cursorPos;
              xterm.write(`\x1b[${moveBack}D`);
            } else {
              xterm.write(data);
            }
          }
      }
      currentLineRef.current = currentLine;
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const executeCommand = useCallback((command: string) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    // Send command to backend via STOMP
    if (projectId) {
      stompClient.sendTerminalInput(projectId, command);
      return;
    }

    // No project context: show local-only commands
    handleLocalCommand(command, xterm);
  }, [projectId]);

  const handleLocalCommand = (command: string, xterm: XTerm) => {
    const parts = command.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case 'help':
        xterm.writeln('\x1b[1;33mAvailable commands:\x1b[0m');
        xterm.writeln('  help        - Show this help message');
        xterm.writeln('  clear       - Clear terminal');
        xterm.writeln('  echo        - Print text');
        xterm.writeln('  date        - Show current date');
        xterm.writeln('  whoami      - Show current user');
        xterm.writeln('');
        xterm.writeln('\x1b[33mNote: Connect to a project for full terminal access.\x1b[0m');
        break;
      case 'clear':
        xterm.clear();
        break;
      case 'echo':
        xterm.writeln(parts.slice(1).join(' '));
        break;
      case 'date':
        xterm.writeln(new Date().toString());
        break;
      case 'whoami':
        xterm.writeln('deepagent');
        break;
      default:
        xterm.writeln(`\x1b[31m${cmd}: command not available (connect to a project for full terminal)\x1b[0m`);
        xterm.writeln('Type \x1b[33mhelp\x1b[0m for available commands.');
    }
  };

  // Receive terminal output from STOMP
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = stompClient.subscribeTaskOutput(projectId, 'terminal', (output) => {
      if (xtermRef.current && output) {
        xtermRef.current.write(output);
      }
    });

    // Update connection status based on STOMP state
    if (stompClient.isConnected()) {
      setIsConnected(true);
    }

    return unsubscribe;
  }, [projectId]);

  return (
    <div className={`flex flex-col h-full bg-[#1a1b26] ${className || ''}`}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#16161e] border-b border-[#292e42]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#f7768e]" />
            <div className="w-3 h-3 rounded-full bg-[#e0af68]" />
            <div className="w-3 h-3 rounded-full bg-[#9ece6a]" />
          </div>
          <span className="text-xs text-[#565f89] ml-2">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isConnected ? 'text-[#9ece6a]' : 'text-[#565f89]'}`}>
            {isConnected ? '● Connected' : '○ Local'}
          </span>
          <button
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
                xtermRef.current.write('\x1b[32m$\x1b[0m ');
              }
            }}
            className="text-xs text-[#565f89] hover:text-[#a9b1d6] transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className="flex-1 px-1 py-0.5 overflow-hidden" />
    </div>
  );
}
