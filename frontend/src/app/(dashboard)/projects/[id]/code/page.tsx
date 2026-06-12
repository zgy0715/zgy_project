'use client';

import { use, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, GitCompare, Terminal as TerminalIcon } from 'lucide-react';
import { FileTree } from '@/components/code/file-tree';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';

// Dynamically import Monaco-based components to avoid SSR issues
const CodeEditor = dynamic(
  () => import('@/components/code/code-editor').then((mod) => mod.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <Spinner size="lg" />
      </div>
    ),
  }
);

const CodeDiff = dynamic(
  () => import('@/components/code/code-diff').then((mod) => mod.CodeDiff),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <Spinner size="lg" />
      </div>
    ),
  }
);

const Terminal = dynamic(
  () => import('@/components/code/terminal'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1a1b26]">
        <Spinner size="sm" />
      </div>
    ),
  }
);

// Generate simulated original code by removing/modifying a few lines
function generateOriginalCode(code: string): string {
  const lines = code.split('\n');
  // Remove every 5th line and modify every 8th line to simulate changes
  const result = lines.filter((_, i) => (i + 1) % 5 !== 0).map((line, i) => {
    if ((i + 1) % 8 === 0 && line.trim().length > 0) {
      return line.replace(/public/, 'private').replace(/final /, '');
    }
    return line;
  });
  return result.join('\n');
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id;

  // Terminal panel visibility
  const [showTerminal, setShowTerminal] = useState(true);

  // Zustand store
  const files = useEditorStore((s) => s.files);
  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const fileContent = useEditorStore((s) => s.fileContent);
  const isDiffMode = useEditorStore((s) => s.isDiffMode);
  const selectFile = useEditorStore((s) => s.selectFile);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const toggleDiffMode = useEditorStore((s) => s.toggleDiffMode);

  // Current active tab info
  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null;

  // Current file content from store
  const currentFileContent = activeTab
    ? fileContent[activeTab.fileId] ?? ''
    : '';

  // Simulated original code for diff mode
  const originalCode = useMemo(
    () => generateOriginalCode(currentFileContent),
    [currentFileContent]
  );

  // Line count
  const lineCount = currentFileContent
    ? currentFileContent.split('\n').length
    : 0;

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Left: File tree (260px) */}
      <div className="w-[260px] flex-shrink-0 bg-surface-1 border-r border-surface-3 flex flex-col">
        <div className="px-4 py-3 border-b border-surface-3">
          <h2 className="text-sm font-medium text-white">项目文件</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <FileTree
            files={files}
            onFileSelect={selectFile}
            activeFilePath={activeTab?.path}
          />
        </div>
      </div>

      {/* Right: Code area (flex-1) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top: Tab bar + Diff toggle */}
        <div className="flex items-center bg-[#1e1e1e] border-b border-surface-3">
          {/* Tabs */}
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
            {openTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer border-r border-[#2d2d2d] select-none whitespace-nowrap',
                  tab.id === activeTabId
                    ? 'bg-[#1e1e1e] text-white border-t-2 border-t-brand-500'
                    : 'bg-[#2d2d2d] text-zinc-400 hover:text-zinc-200'
                )}
              >
                <span className="truncate max-w-[120px]">{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-surface-2 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Diff mode toggle */}
          <button
            onClick={toggleDiffMode}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-[#2d2d2d]',
              isDiffMode
                ? 'text-brand-400 bg-brand-600/10'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Diff 模式
          </button>
        </div>

        {/* Code content + Terminal area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Code editor */}
          <div className="flex-1 min-h-0">
            {activeTab ? (
              isDiffMode ? (
                <CodeDiff
                  original={originalCode}
                  modified={currentFileContent}
                  language={activeTab.language}
                />
              ) : (
                <CodeEditor
                  value={currentFileContent}
                  language={activeTab.language}
                  fileId={activeTab.fileId}
                  projectId={projectId}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-zinc-500 text-sm">
                从左侧文件树选择文件以查看代码
              </div>
            )}
          </div>

          {/* Terminal panel */}
          {showTerminal && (
            <div className="h-64 flex-shrink-0 border-t border-[#292e42]">
              <Terminal projectId={projectId} />
            </div>
          )}
        </div>

        {/* Bottom: Status bar */}
        <div className="flex items-center justify-between px-4 py-1 bg-[#1e1e1e] border-t border-surface-3 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            {activeTab && (
              <>
                <span>{activeTab.language}</span>
                <span>行数: {lineCount}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeTab && (
              <span>大小: {formatFileSize(
                currentFileContent
                  ? new Blob([currentFileContent]).size
                  : undefined
              )}</span>
            )}
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
                showTerminal
                  ? 'text-brand-400 hover:text-brand-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
              title={showTerminal ? '隐藏终端' : '显示终端'}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
