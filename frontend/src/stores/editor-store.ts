// Editor state management with Zustand

import { create } from 'zustand';
import type { ProjectFile } from '@/types';

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
  isLoading: boolean;
  error: string | null;

  // Actions
  setFiles: (files: ProjectFile[]) => void;
  openFile: (file: ProjectFile) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleDir: (path: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  files: [],
  openTabs: [],
  activeTabId: null,
  fileContent: {},
  expandedDirs: new Set<string>(),
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

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
