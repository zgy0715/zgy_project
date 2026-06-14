// Project state management with Zustand

import { create } from 'zustand';
import type { Project, ProjectActivity, CreateProjectRequest, UpdateProjectRequest } from '@/types';
import { projectsApi } from '@/lib/api-client';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  activities: ProjectActivity[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setCurrentProjectById: (id: string) => void;
  fetchProjects: (params?: { page?: number; size?: number }) => Promise<void>;
  createProject: (request: CreateProjectRequest) => Promise<void>;
  saveProject: (id: string, data: UpdateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  fetchActivities: (projectId: string) => Promise<void>;
  setActivities: (activities: ProjectActivity[]) => void;
  addActivity: (activity: ProjectActivity) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProject: null,
  activities: [],
  isLoading: false,
  error: null,

  setProjects: (projects) => set({ projects, isLoading: false }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        state.currentProject?.id === id ? null : state.currentProject,
    })),

  setCurrentProject: (currentProject) => set({ currentProject }),

  setCurrentProjectById: (id) =>
    set((state) => ({
      currentProject: state.projects.find((p) => p.id === id) ?? null,
    })),

  fetchProjects: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.list(params);
      const pageData = response.data.data;
      const projects = pageData.content;
      set((state) => ({
        projects,
        currentProject: state.currentProject
          ? projects.find((p) => p.id === state.currentProject!.id) ?? state.currentProject
          : projects[0] ?? null,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取项目列表失败';
      set({ error: message, isLoading: false });
    }
  },

  createProject: async (request) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.create(request);
      const newProject = response.data.data;
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '创建项目失败';
      set({ error: message, isLoading: false });
    }
  },

  saveProject: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.update(id, data);
      const updated = response.data.data;
      get().updateProject(id, updated);
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '更新项目失败';
      set({ error: message, isLoading: false });
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await projectsApi.delete(id);
      get().removeProject(id);
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '删除项目失败';
      set({ error: message, isLoading: false });
    }
  },

  fetchActivities: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.activity(projectId);
      set({ activities: response.data.data, isLoading: false });
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        '获取活动记录失败';
      set({ error: message, isLoading: false });
    }
  },

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities] })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
