// Editor state management with Zustand

import { create } from 'zustand';
import type { ProjectFile } from '@/types';
import { projectsApi } from '@/lib/api-client';
import { generateId, getLanguageFromPath } from '@/lib/utils';

interface EditorTab {
  id: string;
  fileId: string;
  path: string;
  name: string;
  language: string;
  isDirty: boolean;
}

interface EditorState {
  files: ProjectFile[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  fileContent: Record<string, string>;
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
  createFile: (parentPath: string, name: string, type: 'file' | 'directory') => void;
  deleteFile: (path: string) => void;
  renameFile: (path: string, newName: string) => void;

  // API actions
  fetchFileTree: (projectId: string) => Promise<void>;
  fetchFileContent: (projectId: string, fileId: string) => Promise<void>;
  saveFile: (projectId: string, fileId: string) => Promise<void>;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
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
  files: [],
  fileContent: {},
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

  createFile: (parentPath, name, type) =>
    set((state) => {
      const id = generateId();
      const newPath = parentPath ? `${parentPath}/${name}` : name;
      const now = new Date().toISOString();
      const newFile: ProjectFile = {
        id,
        projectId: '',
        name,
        path: newPath,
        type,
        lastModified: now,
        ...(type === 'file' ? { language: getLanguageFromPath(name) } : {}),
      };

      const newFiles = parentPath
        ? addChildToDir(state.files, parentPath, newFile)
        : [...state.files, newFile];

      const newContent = type === 'file'
        ? { ...state.fileContent, [id]: '' }
        : state.fileContent;

      // Auto-expand the parent directory
      const newExpanded = new Set(state.expandedDirs);
      if (parentPath) newExpanded.add(parentPath);

      return {
        files: newFiles,
        fileContent: newContent,
        expandedDirs: newExpanded,
      };
    }),

  deleteFile: (path) =>
    set((state) => {
      const file = findFileByPath(state.files, path);
      if (!file) return state;

      // Collect all paths to close tabs
      const pathsToClose = file.type === 'directory' && file.children
        ? [path, ...collectPaths(file.children)]
        : [path];

      // Close tabs for deleted files
      const newTabs = state.openTabs.filter(
        (t) => !pathsToClose.includes(t.path)
      );

      // Update active tab if it was closed
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId) {
        const activeTab = state.openTabs.find((t) => t.id === state.activeTabId);
        if (activeTab && pathsToClose.includes(activeTab.path)) {
          newActiveTabId =
            newTabs[Math.max(0, newTabs.length - 1)]?.id ?? null;
        }
      }

      // Remove from expanded dirs
      const newExpanded = new Set(state.expandedDirs);
      for (const p of pathsToClose) {
        newExpanded.delete(p);
      }

      return {
        files: removeFileByPath(state.files, path),
        openTabs: newTabs,
        activeTabId: newActiveTabId,
        expandedDirs: newExpanded,
      };
    }),

  renameFile: (path, newName) =>
    set((state) => {
      const file = findFileByPath(state.files, path);
      if (!file) return state;

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

      const newFiles = updateFileInTree(state.files, path, (f) =>
        updatePaths(f, path, newPath)
      );

      // Update open tabs paths
      const newTabs = state.openTabs.map((t) => {
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
      for (const p of state.expandedDirs) {
        if (p === path) {
          newExpanded.add(newPath);
        } else if (p.startsWith(path + '/')) {
          newExpanded.add(newPath + p.substring(path.length));
        } else {
          newExpanded.add(p);
        }
      }

      return {
        files: newFiles,
        openTabs: newTabs,
        expandedDirs: newExpanded,
      };
    }),

  fetchFileTree: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.files(projectId);
      set({ files: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取文件树失败';
      set({ error: message, isLoading: false });
    }
  },

  fetchFileContent: async (projectId, fileId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.fileContent(projectId, fileId);
      const content = response.data.data.content;
      set((state) => ({
        fileContent: { ...state.fileContent, [fileId]: content },
        isLoading: false,
      }));
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取文件内容失败';
      set({ error: message, isLoading: false });
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
        isLoading: false,
      }));
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '保存文件失败';
      set({ error: message, isLoading: false });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
