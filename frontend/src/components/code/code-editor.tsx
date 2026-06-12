'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Pencil, Save, Eye } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useEditorStore } from '@/stores/editor-store';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  language: string;
  readOnly?: boolean;
  fileId?: string;
  projectId?: string;
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
  readOnly: _readOnly = true,
  fileId,
  projectId,
}: CodeEditorProps) {
  const monacoLanguage = useMemo(() => getMonacoLanguage(language), [language]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(false);

  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const saveFile = useEditorStore((s) => s.saveFile);

  // Save handler
  const handleSave = useCallback(() => {
    if (!editModeRef.current || !fileId) return;
    if (projectId) {
      saveFile(projectId, fileId);
    } else {
      // Mock mode: just mark as not dirty
      useEditorStore.setState((state) => ({
        openTabs: state.openTabs.map((t) =>
          t.fileId === fileId ? { ...t, isDirty: false } : t
        ),
      }));
    }
    // Exit edit mode after save
    editModeRef.current = false;
    setEditMode(false);
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: true });
    }
  }, [fileId, projectId, saveFile]);

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
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
        readOnly: true,
        wordWrap: 'on',
        automaticLayout: true,
      });

      // Register Ctrl+S save shortcut in Monaco
      editor.addCommand(
        2048 | 49, // KeyMod.CtrlCmd | KeyCode.KeyS
        () => {
          handleSave();
        }
      );
    },
    [handleSave, monacoLanguage]
  );

  // Handle content change
  const handleEditorChange = useCallback(
    (newValue: string | undefined) => {
      if (!editModeRef.current || !fileId) return;
      updateFileContent(fileId, newValue ?? '');
    },
    [fileId, updateFileContent]
  );

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    const newMode = !editModeRef.current;
    editModeRef.current = newMode;
    setEditMode(newMode);
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: !newMode });
    }
  }, []);

  // Keyboard shortcut for save (global window listener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editModeRef.current) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="h-full w-full relative">
      {/* Edit mode toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        {editMode && (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30 transition-colors"
            title="保存 (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            保存
          </button>
        )}
        <button
          onClick={toggleEditMode}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            editMode
              ? 'bg-brand-600/20 text-brand-400 hover:bg-brand-600/30'
              : 'bg-surface-2/80 text-zinc-400 hover:text-white hover:bg-surface-3'
          )}
          title={editMode ? '切换到只读模式' : '切换到编辑模式'}
        >
          {editMode ? (
            <>
              <Pencil className="w-3.5 h-3.5" />
              编辑中
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              只读
            </>
          )}
        </button>
      </div>

      {/* Edit mode indicator bar */}
      {editMode && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 z-10" />
      )}

      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
            <Spinner size="lg" />
          </div>
        }
        options={{
          readOnly: !editMode,
        }}
      />
    </div>
  );
}
