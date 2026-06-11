'use client';

import { useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '@/stores/editor-store';

interface CodeEditorProps {
  fileId: string;
  language: string;
  initialValue?: string;
  readOnly?: boolean;
}

export function CodeEditor({
  fileId,
  language,
  initialValue = '',
  readOnly = false,
}: CodeEditorProps) {
  const updateFileContent = useEditorStore((s) => s.updateFileContent);

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      // Configure editor settings
      editor.updateOptions({
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        padding: { top: 16 },
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
        readOnly,
      });
    },
    [readOnly]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        updateFileContent(fileId, value);
      }
    },
    [fileId, updateFileContent]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={initialValue}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-surface-0">
            <div className="text-sm text-zinc-500">Loading editor...</div>
          </div>
        }
        options={{
          readOnly,
        }}
      />
    </div>
  );
}
