'use client';

import { useCallback, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Spinner } from '@/components/ui/spinner';

interface CodeEditorProps {
  value: string;
  language: string;
  readOnly?: boolean;
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

export function CodeEditor({
  value,
  language,
  readOnly = true,
}: CodeEditorProps) {
  const monacoLanguage = useMemo(() => getMonacoLanguage(language), [language]);

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editor.updateOptions({
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontLigatures: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        padding: { top: 16 },
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
        readOnly,
        wordWrap: 'on',
        automaticLayout: true,
      });
    },
    [readOnly]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
            <Spinner size="lg" />
          </div>
        }
        options={{
          readOnly,
        }}
      />
    </div>
  );
}
