// Project state management with Zustand

import { create } from 'zustand';
import type { Project, ProjectActivity, CreateProjectRequest } from '@/types';
import { mockProjects, mockActivities } from '@/lib/mock-data';

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
  createProject: (request: CreateProjectRequest) => void;
  setActivities: (activities: ProjectActivity[]) => void;
  addActivity: (activity: ProjectActivity) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  // Initialize with mock project data
  projects: mockProjects,
  currentProject: mockProjects[0],
  activities: mockActivities,
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

  createProject: (request) =>
    set((state) => {
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
      return {
        projects: [newProject, ...state.projects],
        currentProject: newProject,
      };
    }),

  setActivities: (activities) => set({ activities }),

  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities] })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearError: () => set({ error: null }),
}));
