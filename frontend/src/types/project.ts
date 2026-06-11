// Project-related type definitions for DeepAgent platform

export type ProjectStatus = 'active' | 'archived' | 'draft';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  members: ProjectMember[];
  techStack: string[];
  repository?: string;
  workflowId?: string;
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  userId: string;
  username: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  joinedAt: string;
}

export interface ProjectStats {
  totalAgents: number;
  totalWorkflows: number;
  totalConversations: number;
  totalTokens: number;
  codeFiles: number;
  lastActivityAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  language?: string;
  size?: number;
  content?: string;
  lastModified: string;
  children?: ProjectFile[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  action: string;
  target: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  techStack: string[];
  repository?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  techStack?: string[];
}
