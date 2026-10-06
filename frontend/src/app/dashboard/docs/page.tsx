'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Spinner } from '@/components/ui/spinner';
import { useProjectStore } from '@/stores/project-store';
import { projectsApi } from '@/lib/api-client';
import type { ProjectFile } from '@/types';

interface DocFile {
  filename: string;
  path: string;
  title: string;
  size_bytes: number;
}

interface DocContent {
  filename: string;
  path: string;
  title: string;
  content: string;
  size_bytes: number;
}

// Recursively filter for document files (.md, .txt)
function filterDocFiles(files: ProjectFile[], basePath = ''): DocFile[] {
  const result: DocFile[] = [];
  for (const file of files) {
    const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
    if (file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      result.push({
        filename: file.name,
        path: file.path ?? fullPath,
        title: file.name.replace(/\.(md|txt)$/, ''),
        size_bytes: file.size ?? 0,
      });
    }
    if (file.type === 'directory' && file.children) {
      result.push(...filterDocFiles(file.children, fullPath));
    }
  }
  return result;
}

// Flatten nested file tree into a flat array
function flattenFiles(files: ProjectFile[]): ProjectFile[] {
  const result: ProjectFile[] = [];
  for (const file of files) {
    result.push(file);
    if (file.children) {
      result.push(...flattenFiles(file.children));
    }
  }
  return result;
}

export default function DocsPage() {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DocContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const projects = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Load files when project is selected
  useEffect(() => {
    if (!selectedProjectId) return;
    const loadFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await projectsApi.files(selectedProjectId);
        const projectFiles = response.data.data;
        const docFiles = filterDocFiles(projectFiles);
        setFiles(docFiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文档列表失败');
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [selectedProjectId]);

  // Clear files and selection when project changes
  useEffect(() => {
    setFiles([]);
    setSelectedFile(null);
  }, [selectedProjectId]);

  const loadFile = async (filePath: string) => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.files(selectedProjectId);
      const allFiles = flattenFiles(response.data.data);
      const file = allFiles.find((f) => f.path === filePath);
      if (file) {
        const contentResponse = await projectsApi.fileContent(selectedProjectId, file.id);
        setSelectedFile({
          filename: file.name,
          path: file.path,
          title: file.name.replace(/\.(md|txt)$/, ''),
          content: contentResponse.data.data.content ?? '',
          size_bytes: file.size ?? 0,
        });
      } else {
        setError('文件未找到');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文档失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar: File list */}
      <div className="w-64 border-r border-surface-3 bg-surface-1 overflow-y-auto">
        <div className="p-4 border-b border-surface-3">
          <h2 className="text-sm font-semibold text-white">项目文档</h2>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">选择项目...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {files.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">{files.length} 个文档</p>
          )}
        </div>
        <div className="py-2">
          {!selectedProjectId ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              请先选择项目
            </div>
          ) : files.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              暂无文档
            </div>
          ) : (
            files.map((file) => (
            <button
              key={file.path}
              onClick={() => loadFile(file.path)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selectedFile?.path === file.path
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-zinc-300 hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">{file.filename}</span>
              </div>
            </button>
          ))
          )}
        </div>
      </div>

      {/* Main: Document viewer */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <p className="text-lg text-red-400">{error}</p>
          </div>
        ) : selectedFile ? (
          <div className="max-w-4xl mx-auto p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">{selectedFile.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                <span>{selectedFile.filename}</span>
                {selectedFile.size_bytes > 0 && (
                  <span>{(selectedFile.size_bytes / 1024).toFixed(1)} KB</span>
                )}
              </div>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{selectedFile.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg">选择左侧文档查看内容</p>
            <p className="text-sm mt-1">支持读取项目中的 Markdown 文件</p>
          </div>
        )}
      </div>
    </div>
  );
}
