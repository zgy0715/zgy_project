// Project-related type definitions for DeepAgent platform

// The gateway serializes `Project.Status` with @Enumerated(EnumType.STRING),
// so the wire values are the raw UPPERCASE Java enum names.
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

// Single source of truth for rendering a project status anywhere in the UI.
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: '进行中',
  ARCHIVED: '已归档',
  DELETED: '已删除',
};

export const PROJECT_STATUS_VARIANT: Record<
  ProjectStatus,
  'success' | 'warning' | 'secondary'
> = {
  ACTIVE: 'success',
  ARCHIVED: 'warning',
  DELETED: 'secondary',
};

/** Safe status -> Chinese label lookup that tolerates unknown/legacy values. */
export function projectStatusLabel(status?: string | null): string {
  if (!status) return '未知';
  return PROJECT_STATUS_LABEL[status as ProjectStatus] ?? status;
}

/** Safe status -> badge variant lookup that tolerates unknown/legacy values. */
export function projectStatusVariant(
  status?: string | null
): 'success' | 'warning' | 'secondary' {
  if (!status) return 'secondary';
  return PROJECT_STATUS_VARIANT[status as ProjectStatus] ?? 'secondary';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  agentType?: string;
  config?: string;
  createdAt: string;
  updatedAt: string;
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

// Mirrors the gateway `ProjectRequest` record: (name, description, agentType, config).
export interface CreateProjectRequest {
  name: string;
  description: string;
  agentType?: string;
  config?: string;
}

// Mirrors the gateway `ProjectRequest` record plus the updatable status.
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  agentType?: string;
  config?: string;
}
