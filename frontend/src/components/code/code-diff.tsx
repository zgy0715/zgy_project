'use client';

import { useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Spinner } from '@/components/ui/spinner';

interface CodeDiffProps {
  original: string;
  modified: string;
  language: string;
}

// Map file extension to Monaco language identifier
function getMonacoLanguage(language: string): string {
  const map: Record<string, string> = {
    java: 'java',
    python: 'python',
    typescript: 'typescript',
    tsx: 'typescript',
    javascript: 'javascript',
    jsx: 'javascript',
    yaml: 'yaml',
    xml: 'xml',
    json: 'json',
    markdown: 'markdown',
    dockerfile: 'dockerfile',
    sql: 'sql',
    css: 'css',
    html: 'html',
    shell: 'shell',
    plaintext: 'plaintext',
  };
  return map[language] ?? 'plaintext';
}

export function CodeDiff({ original, modified, language }: CodeDiffProps) {
  const monacoLanguage = useMemo(() => getMonacoLanguage(language), [language]);

  return (
    <div className="h-full w-full">
      <DiffEditor
        height="100%"
        language={monacoLanguage}
        original={original}
        modified={modified}
        theme="vs-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
            <Spinner size="lg" />
          </div>
        }
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          lineNumbers: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
