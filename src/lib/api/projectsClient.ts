const USER_ID = 'default-user';

export interface ProjectStep {
  id: string;
  projectId: string;
  title: string;
  orderIndex: number;
  status: string;
  taskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  goalText?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  steps: ProjectStep[];
}

export async function listProjects(userId = USER_ID): Promise<Project[]> {
  const res = await fetch(`/api/projects?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('failed to fetch projects');
  const json = await res.json() as { ok: boolean; projects: Project[] };
  return json.projects;
}

export async function getProject(id: string, userId = USER_ID): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('project not found');
  const json = await res.json() as { ok: boolean; project: Project };
  return json.project;
}
