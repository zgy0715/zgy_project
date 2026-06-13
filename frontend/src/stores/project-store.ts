// Project state management with Zustand - dual mode (mock/api) support

import { create } from 'zustand';
import type { Project, ProjectActivity, CreateProjectRequest, UpdateProjectRequest } from '@/types';
import { mockProjects, mockActivities } from '@/lib/mock-data';
import { API_MODE } from '@/lib/constants';
import { projectsApi } from '@/lib/api-client';

const apiMode = API_MODE;

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
  fetchProjects: () => Promise<void>;
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

// In mock mode, initialize with mock project data
const mockDefaults = {
  projects: mockProjects,
  currentProject: mockProjects[0],
  activities: mockActivities,
};

// In API mode, start empty (data will be fetched)
const apiDefaults = {
  projects: [],
  currentProject: null,
  activities: [],
};

const defaults = apiMode === 'mock' ? mockDefaults : apiDefaults;

export const useProjectStore = create<ProjectState>()((set, get) => ({
  ...defaults,
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

  fetchProjects: async () => {
    if (apiMode === 'mock') {
      // Mock mode: data is already loaded
      return;
    }

    // API mode: fetch projects from backend (paginated response)
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.list();
      const projects = response.data.data.items;
      set({
        projects,
        currentProject: projects[0] ?? null,
        isLoading: false,
      });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch projects';
      set({ error: message, isLoading: false });
    }
  },

  createProject: async (request) => {
    if (apiMode === 'mock') {
      // Mock mode: create project locally
      const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: request.name,
        description: request.description,
        status: 'draft',
        ownerId: 'user-1',
        members: [
          {
            userId: 'user-1',
            username: 'Demo User',
            role: 'owner',
            joinedAt: new Date().toISOString(),
          },
        ],
        techStack: request.techStack,
        repository: request.repository,
        stats: {
          totalAgents: 0,
          totalWorkflows: 0,
          totalConversations: 0,
          totalTokens: 0,
          codeFiles: 0,
          lastActivityAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject,
      }));
      return;
    }

    // API mode: create project via API
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
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create project';
      set({ error: message, isLoading: false });
    }
  },

  saveProject: async (id, data) => {
    if (apiMode === 'mock') {
      // Mock mode: update project locally
      get().updateProject(id, data);
      return;
    }

    // API mode: update project via API
    set({ isLoading: true, error: null });
    try {
      const response = await projectsApi.update(id, data);
      const updated = response.data.data;
      get().updateProject(id, updated);
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update project';
      set({ error: message, isLoading: false });
    }
  },

  deleteProject: async (id) => {
    if (apiMode === 'mock') {
      // Mock mode: remove project locally
      get().removeProject(id);
      return;
    }

    // API mode: delete project via API
    set({ isLoading: true, error: null });
    try {
      await projectsApi.delete(id);
      get().removeProject(id);
      set({ isLoading: false });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete project';
      set({ error: message, isLoading: false });
    }
  },

  fetchActivities: async (projectId) => {
    if (apiMode === 'mock') {
      // Mock mode: activities already loaded
      return;
    }

    // API mode: fetch activities from backend
    try {
      const response = await projectsApi.activity(projectId);
      set({ activities: response.data.data });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to fetch activities';
      set({ error: message });
    }
  },

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities] })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
