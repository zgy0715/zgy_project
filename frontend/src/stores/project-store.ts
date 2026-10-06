// Project state management with Zustand

import { create } from 'zustand';
import type { Project, ProjectActivity, CreateProjectRequest, UpdateProjectRequest } from '@/types';
import { projectsApi } from '@/lib/api-client';
import { asArray, getErrorMessage } from '@/lib/utils';

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
  fetchProject: (id: string) => Promise<void>;
  createProject: (request: CreateProjectRequest) => Promise<boolean>;
  saveProject: (id: string, data: UpdateProjectRequest) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  fetchActivities: (projectId: string, params?: { limit?: number }) => Promise<void>;
  setActivities: (activities: ProjectActivity[]) => void;
  addActivity: (activity: ProjectActivity) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// Ids arrive from the gateway as numbers (Java Long) but from the URL as
// strings, so every comparison goes through the string form.
const sameId = (a: unknown, b: unknown) => String(a) === String(b);

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
        sameId(p.id, id) ? { ...p, ...updates } : p
      ),
      currentProject:
        state.currentProject && sameId(state.currentProject.id, id)
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => !sameId(p.id, id)),
      currentProject:
        state.currentProject && sameId(state.currentProject.id, id)
          ? null
          : state.currentProject,
    })),

  setCurrentProject: (currentProject) => set({ currentProject }),

  setCurrentProjectById: (id) =>
    set((state) => ({
      currentProject: state.projects.find((p) => sameId(p.id, id)) ?? null,
    })),

  fetchProjects: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.list(params);
      const projects = asArray<Project>(response.data.data);
      set((state) => ({
        projects,
        currentProject: state.currentProject
          ? projects.find((p) => sameId(p.id, state.currentProject!.id)) ??
            state.currentProject
          : projects[0] ?? null,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取项目列表失败'),
        isLoading: false,
      });
    }
  },

  fetchProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.detail(id);
      const project = response.data.data;
      set((state) => ({
        projects: state.projects.some((p) => sameId(p.id, project.id))
          ? state.projects.map((p) => (sameId(p.id, project.id) ? project : p))
          : [project, ...state.projects],
        currentProject: project,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: getErrorMessage(error, '获取项目详情失败'),
        isLoading: false,
      });
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
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '创建项目失败'),
        isLoading: false,
      });
      return false;
    }
  },

  saveProject: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.update(id, data);
      const updated = response.data.data;
      get().updateProject(id, updated);
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '更新项目失败'),
        isLoading: false,
      });
      return false;
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await projectsApi.delete(id);
      get().removeProject(id);
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({
        error: getErrorMessage(error, '删除项目失败'),
        isLoading: false,
      });
      return false;
    }
  },

  fetchActivities: async (projectId, params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.activity(projectId, params);
      set({ activities: asArray<ProjectActivity>(response.data.data), isLoading: false });
    } catch (error) {
      set({
        // Activity history is supplementary: keep the page usable on failure.
        activities: [],
        error: getErrorMessage(error, '获取活动记录失败'),
        isLoading: false,
      });
    }
  },

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities] })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
