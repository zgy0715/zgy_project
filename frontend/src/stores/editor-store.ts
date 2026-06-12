// Editor state management with Zustand - dual mode (mock/api) support

import { create } from 'zustand';
import type { ProjectFile } from '@/types';
import { mockFileTree, mockFileContents } from '@/lib/mock-data';
import { API_MODE } from '@/lib/constants';
import { projectsApi } from '@/lib/api-client';

const apiMode = API_MODE;

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

  // API mode actions
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

// In mock mode, initialize with mock file tree and contents
const mockDefaults = {
  files: mockFileTree,
  fileContent: { ...mockFileContents },
  expandedDirs: new Set<string>(['src', 'src/main', 'src/main/java', 'src/main/java/com', 'src/main/java/com/example', 'src/main/java/com/example/ecommerce', 'src/main/resources']),
};

// In API mode, start empty (data will be fetched)
const apiDefaults = {
  files: [],
  fileContent: {},
  expandedDirs: new Set<string>(),
};

const defaults = apiMode === 'mock' ? mockDefaults : apiDefaults;

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...defaults,
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

  fetchFileTree: async (projectId) => {
    if (apiMode === 'mock') {
      // Mock mode: file tree already loaded
      return;
    }

    // API mode: fetch file tree from backend
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.files(projectId);
      set({ files: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch file tree';
      set({ error: message, isLoading: false });
    }
  },

  fetchFileContent: async (projectId, fileId) => {
    if (apiMode === 'mock') {
      // Mock mode: file content already loaded
      return;
    }

    // API mode: fetch file content from backend
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
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch file content';
      set({ error: message, isLoading: false });
    }
  },

  saveFile: async (projectId, fileId) => {
    if (apiMode === 'mock') {
      // Mock mode: mark tab as not dirty (content is already in state)
      set((state) => ({
        openTabs: state.openTabs.map((t) =>
          t.fileId === fileId ? { ...t, isDirty: false } : t
        ),
      }));
      return;
    }

    // API mode: save file content to backend
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
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save file';
      set({ error: message, isLoading: false });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
