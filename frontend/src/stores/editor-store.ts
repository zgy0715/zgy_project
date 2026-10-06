// Editor state management with Zustand

import { create } from 'zustand';
import type { ProjectFile } from '@/types';
import { projectsApi } from '@/lib/api-client';
import { generateId, getLanguageFromPath, asArray, getErrorMessage } from '@/lib/utils';

interface EditorTab {
  id: string;
  fileId: string;
  path: string;
  name: string;
  language: string;
  isDirty: boolean;
}

interface EditorState {
  projectId: string | null;
  files: ProjectFile[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  fileContent: Record<string, string>;
  /** Last content loaded from / saved to the gateway — the diff baseline. */
  originalContent: Record<string, string>;
  expandedDirs: Set<string>;
  isDiffMode: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setFiles: (files: ProjectFile[]) => void;
  openFile: (file: ProjectFile) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleDir: (path: string) => void;
  selectFile: (path: string) => void;
  toggleDiffMode: () => void;
  createFile: (parentPath: string, name: string, type: 'file' | 'directory') => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  renameFile: (path: string, newName: string) => Promise<boolean>;

  // API actions
  fetchFileTree: (projectId: string) => Promise<void>;
  fetchFileContent: (projectId: string, fileId: string) => Promise<void>;
  saveFile: (projectId: string, fileId: string) => Promise<void>;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Helper: the gateway may return either a nested tree or a flat list of files
// carrying slash-separated paths. Normalise both into a nested tree.
function normalizeFiles(raw: ProjectFile[]): ProjectFile[] {
  if (raw.some((f) => f.children && f.children.length > 0)) return raw;

  const byPath = new Map<string, ProjectFile>();
  const roots: ProjectFile[] = [];
  const normalized = raw.map((f) => ({
    ...f,
    path: f.path ?? f.name,
    children: f.children ? [...f.children] : undefined,
  }));

  for (const file of normalized) {
    byPath.set(file.path, file);
  }

  for (const file of normalized) {
    const lastSlash = file.path.lastIndexOf('/');
    if (lastSlash < 0) {
      roots.push(file);
      continue;
    }
    const parent = byPath.get(file.path.slice(0, lastSlash));
    if (parent && parent.type === 'directory') {
      parent.children = [...(parent.children ?? []), file];
    } else {
      roots.push(file);
    }
  }

  return roots;
}

// Helper: find a file by path in the nested tree
function findFileByPath(
  files: ProjectFile[],
  path: string
): ProjectFile | null {
  for (const file of files) {
    if (file.path === path) return file;
    if (file.children) {
      const found = findFileByPath(file.children, path);
      if (found) return found;
    }
  }
  return null;
}

// Helper: remove a file by path from the nested tree (returns new array)
function removeFileByPath(
  files: ProjectFile[],
  path: string
): ProjectFile[] {
  return files
    .filter((f) => f.path !== path)
    .map((f) => {
      if (f.children) {
        return { ...f, children: removeFileByPath(f.children, path) };
      }
      return f;
    });
}

// Helper: update a file by path in the nested tree
function updateFileInTree(
  files: ProjectFile[],
  path: string,
  updater: (file: ProjectFile) => ProjectFile
): ProjectFile[] {
  return files.map((f) => {
    if (f.path === path) return updater(f);
    if (f.children) {
      return { ...f, children: updateFileInTree(f.children, path, updater) };
    }
    return f;
  });
}

// Helper: add a child to a directory by path
function addChildToDir(
  files: ProjectFile[],
  dirPath: string,
  child: ProjectFile
): ProjectFile[] {
  return files.map((f) => {
    if (f.path === dirPath && f.type === 'directory') {
      return { ...f, children: [...(f.children ?? []), child] };
    }
    if (f.children) {
      return { ...f, children: addChildToDir(f.children, dirPath, child) };
    }
    return f;
  });
}

// Helper: collect all file paths under a given path (for closing tabs)
function collectPaths(files: ProjectFile[]): string[] {
  const paths: string[] = [];
  for (const f of files) {
    paths.push(f.path);
    if (f.children) {
      paths.push(...collectPaths(f.children));
    }
  }
  return paths;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  projectId: null,
  files: [],
  fileContent: {},
  originalContent: {},
  expandedDirs: new Set<string>(),
  openTabs: [],
  activeTabId: null,
  isDiffMode: false,
  isLoading: false,
  error: null,

  setFiles: (files) => set({ files, isLoading: false }),

  openFile: (file) =>
    set((state) => {
      const tabId = file.id;
      const existingTab = state.openTabs.find((t) => t.fileId === file.id);

      if (existingTab) {
        return { activeTabId: tabId };
      }

      const newTab: EditorTab = {
        id: tabId,
        fileId: file.id,
        path: file.path,
        name: file.name,
        language: file.language ?? 'plaintext',
        isDirty: false,
      };

      return {
        openTabs: [...state.openTabs, newTab],
        activeTabId: tabId,
      };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const newTabs = state.openTabs.filter((t) => t.id !== tabId);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === tabId) {
        const closedIndex = state.openTabs.findIndex((t) => t.id === tabId);
        newActiveTabId =
          newTabs[Math.min(closedIndex, newTabs.length - 1)]?.id ?? null;
      }

      return { openTabs: newTabs, activeTabId: newActiveTabId };
    }),

  setActiveTab: (activeTabId) => set({ activeTabId }),

  updateFileContent: (fileId, content) =>
    set((state) => ({
      fileContent: { ...state.fileContent, [fileId]: content },
      openTabs: state.openTabs.map((t) =>
        t.fileId === fileId ? { ...t, isDirty: true } : t
      ),
    })),

  toggleDir: (path) =>
    set((state) => {
      const newExpanded = new Set(state.expandedDirs);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedDirs: newExpanded };
    }),

  selectFile: (path) => {
    const { files } = get();
    const file = findFileByPath(files, path);
    if (file && file.type === 'file') {
      get().openFile(file);
    }
  },

  toggleDiffMode: () =>
    set((state) => ({ isDiffMode: !state.isDiffMode })),

  createFile: async (parentPath, name, type) => {
    const { projectId, files, fileContent, expandedDirs } = get();
    const id = generateId();
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    const now = new Date().toISOString();
    const newFile: ProjectFile = {
      id,
      projectId: projectId ?? '',
      name,
      path: newPath,
      type,
      lastModified: now,
      ...(type === 'file' ? { language: getLanguageFromPath(name) } : {}),
    };

    // Apply optimistically, then persist; roll back if the gateway rejects it.
    const newFiles = parentPath
      ? addChildToDir(files, parentPath, newFile)
      : [...files, newFile];

    const newContent = type === 'file'
      ? { ...fileContent, [id]: '' }
      : fileContent;

    // Auto-expand the parent directory
    const newExpanded = new Set(expandedDirs);
    if (parentPath) newExpanded.add(parentPath);

    set({
      files: newFiles,
      fileContent: newContent,
      expandedDirs: newExpanded,
      error: null,
    });

    if (!projectId) return true;

    try {
      await projectsApi.createFile(projectId, {
        name,
        path: newPath,
        type,
        ...(type === 'file' ? { content: '' } : {}),
      });
      return true;
    } catch (error) {
      set({
        files,
        fileContent,
        expandedDirs,
        error: getErrorMessage(error, '创建文件失败'),
      });
      return false;
    }
  },

  deleteFile: async (path) => {
    const { projectId, files, openTabs, activeTabId, expandedDirs } = get();
    const file = findFileByPath(files, path);
    if (!file) return false;

    // Collect all paths to close tabs
    const pathsToClose = file.type === 'directory' && file.children
      ? [path, ...collectPaths(file.children)]
      : [path];

    // Close tabs for deleted files
    const newTabs = openTabs.filter(
      (t) => !pathsToClose.includes(t.path)
    );

    // Update active tab if it was closed
    let newActiveTabId = activeTabId;
    if (activeTabId) {
      const activeTab = openTabs.find((t) => t.id === activeTabId);
      if (activeTab && pathsToClose.includes(activeTab.path)) {
        newActiveTabId =
          newTabs[Math.max(0, newTabs.length - 1)]?.id ?? null;
      }
    }

    // Remove from expanded dirs
    const newExpanded = new Set(expandedDirs);
    for (const p of pathsToClose) {
      newExpanded.delete(p);
    }

    set({
      files: removeFileByPath(files, path),
      openTabs: newTabs,
      activeTabId: newActiveTabId,
      expandedDirs: newExpanded,
      error: null,
    });

    if (!projectId || !file.id) return true;

    try {
      await projectsApi.deleteFile(projectId, file.id);
      return true;
    } catch (error) {
      set({
        files,
        openTabs,
        activeTabId,
        expandedDirs,
        error: getErrorMessage(error, '删除文件失败'),
      });
      return false;
    }
  },

  renameFile: async (path, newName) => {
    const { projectId, files, openTabs, expandedDirs } = get();
    const file = findFileByPath(files, path);
    if (!file) return false;

    // Compute the parent path from the old path
    const lastSlash = path.lastIndexOf('/');
    const parentPath = lastSlash >= 0 ? path.substring(0, lastSlash) : '';
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    // Recursively update paths for children
    function updatePaths(f: ProjectFile, oldBase: string, newBase: string): ProjectFile {
      const updatedPath = newBase + f.path.substring(oldBase.length);
      return {
        ...f,
        name: f.path === path ? newName : f.name,
        path: updatedPath,
        ...(f.children
          ? { children: f.children.map((c) => updatePaths(c, oldBase, newBase)) }
          : {}),
      };
    }

    const newFiles = updateFileInTree(files, path, (f) =>
      updatePaths(f, path, newPath)
    );

    // Update open tabs paths
    const newTabs = openTabs.map((t) => {
      if (t.path === path) {
        return { ...t, path: newPath, name: newName };
      }
      if (t.path.startsWith(path + '/')) {
        return { ...t, path: newPath + t.path.substring(path.length) };
      }
      return t;
    });

    // Update expanded dirs
    const newExpanded = new Set<string>();
    for (const p of expandedDirs) {
      if (p === path) {
        newExpanded.add(newPath);
      } else if (p.startsWith(path + '/')) {
        newExpanded.add(newPath + p.substring(path.length));
      } else {
        newExpanded.add(p);
      }
    }

    set({
      files: newFiles,
      openTabs: newTabs,
      expandedDirs: newExpanded,
      error: null,
    });

    if (!projectId || !file.id) return true;

    try {
      await projectsApi.renameFile(projectId, file.id, {
        name: newName,
        path: newPath,
      });
      return true;
    } catch (error) {
      set({
        files,
        openTabs,
        expandedDirs,
        error: getErrorMessage(error, '重命名失败'),
      });
      return false;
    }
  },

  fetchFileTree: async (projectId) => {
    set({ isLoading: true, error: null, projectId });
    try {
      const response = await projectsApi.files(projectId);
      set({ files: normalizeFiles(asArray<ProjectFile>(response.data.data)), isLoading: false });
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取文件树失败'),
        isLoading: false,
      });
    }
  },

  fetchFileContent: async (projectId, fileId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.fileContent(projectId, fileId);
      const payload = response.data.data as unknown as { content?: string } | null;
      const content = payload?.content ?? '';
      set((state) => ({
        fileContent: { ...state.fileContent, [fileId]: content },
        // Keep the server copy as the diff baseline; only saveFile updates it.
        originalContent: { ...state.originalContent, [fileId]: content },
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取文件内容失败'),
        isLoading: false,
      });
    }
  },

  saveFile: async (projectId, fileId) => {
    const content = get().fileContent[fileId];
    if (content === undefined) return;

    set({ isLoading: true, error: null });
    try {
      await projectsApi.updateFile(projectId, fileId, content);
      set((state) => ({
        openTabs: state.openTabs.map((t) =>
          t.fileId === fileId ? { ...t, isDirty: false } : t
        ),
        // The saved content becomes the new diff baseline.
        originalContent: { ...state.originalContent, [fileId]: content },
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: getErrorMessage(error, '保存文件失败'),
        isLoading: false,
      });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
