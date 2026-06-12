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
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
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
            setCommandHistory(prev => [...prev, currentLine.trim()]);
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
          if (commandHistory.length > 0) {
            const newIndex = Math.min(historyIndexRef.current + 1, commandHistory.length - 1);
            if (newIndex !== historyIndexRef.current) {
              historyIndexRef.current = newIndex;
              const cmd = commandHistory[commandHistory.length - 1 - newIndex];
              // Clear current line and write history command
              xterm.write(`\x1b[2K\r\x1b[32m$\x1b[0m ${cmd}`);
              currentLine = cmd;
              cursorPos = cmd.length;
            }
          }
          break;
        case '\x1b[B': // Down arrow
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const cmd = commandHistory[commandHistory.length - 1 - historyIndexRef.current];
            xterm.write(`\x1b[2K\r\x1b[32m$\x1b[0m ${cmd}`);
            currentLine = cmd;
            cursorPos = cmd.length;
          } else if (historyIndexRef.current === 0) {
            historyIndexRef.current = -1;
            xterm.write('\x1b[2K\r\x1b[32m$\x1b[0m ');
            currentLine = '';
            cursorPos = 0;
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
            xterm.write(data);
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

    // In API mode, send command to backend via STOMP
    if (process.env.NEXT_PUBLIC_API_MODE === 'api' && projectId) {
      // Send command via STOMP to backend terminal service
      stompClient.sendTerminalInput(projectId, command);
      return;
    }

    // Mock mode: simulate command execution
    simulateCommand(command, xterm);
  }, [projectId]);

  const simulateCommand = (command: string, xterm: XTerm) => {
    const parts = command.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case 'help':
        xterm.writeln('\x1b[1;33mAvailable commands:\x1b[0m');
        xterm.writeln('  help        - Show this help message');
        xterm.writeln('  ls          - List files');
        xterm.writeln('  pwd         - Print working directory');
        xterm.writeln('  echo        - Print text');
        xterm.writeln('  clear       - Clear terminal');
        xterm.writeln('  date        - Show current date');
        xterm.writeln('  whoami      - Show current user');
        xterm.writeln('  python      - Run Python (simulated)');
        xterm.writeln('  pytest      - Run tests (simulated)');
        xterm.writeln('  git         - Git operations (simulated)');
        break;
      case 'ls':
        xterm.writeln('\x1b[34msrc/\x1b[0m  \x1b[34mtests/\x1b[0m  \x1b[32mREADME.md\x1b[0m  \x1b[32mpom.xml\x1b[0m  \x1b[32mDockerfile\x1b[0m');
        break;
      case 'pwd':
        xterm.writeln('/workspace/deepagent');
        break;
      case 'echo':
        xterm.writeln(parts.slice(1).join(' '));
        break;
      case 'clear':
        xterm.clear();
        break;
      case 'date':
        xterm.writeln(new Date().toString());
        break;
      case 'whoami':
        xterm.writeln('deepagent');
        break;
      case 'python':
        xterm.writeln('\x1b[33mPython 3.11.5 (simulated)\x1b[0m');
        xterm.writeln('>>> (Interactive mode not available in demo)');
        break;
      case 'pytest':
        xterm.writeln('\x1b[32m============================= test session starts =============================\x1b[0m');
        xterm.writeln('collected 35 items');
        xterm.writeln('');
        xterm.writeln('\x1b[32mtest_agents.py ........\x1b[0m                                                  [ 22%]');
        xterm.writeln('\x1b[32mtest_workflow.py .......\x1b[0m                                                 [ 43%]');
        xterm.writeln('\x1b[32mtest_tools.py ..........\x1b[0m                                                [ 71%]');
        xterm.writeln('\x1b[32mtest_api.py .........\x1b[0m                                                   [100%]');
        xterm.writeln('');
        xterm.writeln('\x1b[32m============================== 35 passed in 2.13s ==============================\x1b[0m');
        break;
      case 'git':
        if (parts[1] === 'status') {
          xterm.writeln('On branch \x1b[32mmaster\x1b[0m');
          xterm.writeln('nothing to commit, working tree clean');
        } else if (parts[1] === 'log') {
          xterm.writeln('\x1b[33mcommit b58e6b1\x1b[0m (HEAD -> master, origin/master)');
          xterm.writeln('Author: Demo User <demo@deepagent.dev>');
          xterm.writeln('Date:   ' + new Date().toISOString().split('T')[0]);
          xterm.writeln('');
          xterm.writeln('    feat: implement interactive demo');
        } else {
          xterm.writeln(`\x1b[31mgit: '${parts[1]}' is not a git command.\x1b[0m`);
        }
        break;
      default:
        xterm.writeln(`\x1b[31mbash: ${cmd}: command not found\x1b[0m`);
        xterm.writeln('Type \x1b[33mhelp\x1b[0m for available commands.');
    }
  };

  // Receive terminal output from STOMP
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MODE !== 'api' || !projectId) return;

    const unsubscribe = stompClient.subscribeTaskOutput(projectId, 'terminal', (output) => {
      if (xtermRef.current && output) {
        xtermRef.current.write(output);
      }
    });

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
