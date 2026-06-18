const USER_ID = 'default-user';

export interface IntakeTask {
  title: string;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface IntakeProjectStep {
  title: string;
  orderIndex: number;
}

export interface IntakePreview {
  type: 'single_task' | 'multi_task' | 'project';
  rawText: string;
  tasks: IntakeTask[];
  project?: {
    title: string;
    description?: string;
    goalText?: string;
    steps: IntakeProjectStep[];
  };
  openQuestions: string[];
}

export interface IntakePreviewResponse {
  ok: boolean;
  preview: IntakePreview;
}

export interface IntakeCommitResponse {
  ok: boolean;
  intakeId: string;
  taskIds: string[];
  projectId?: string;
  stepIds: string[];
}

export async function previewIntake(
  text: string,
  userId = USER_ID,
): Promise<IntakePreviewResponse> {
  const res = await fetch('/api/intake/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, userId }),
  });
  if (!res.ok) throw new Error('intake preview failed');
  return res.json() as Promise<IntakePreviewResponse>;
}

export async function commitIntake(
  preview: IntakePreview,
  rawText: string,
  userId = USER_ID,
): Promise<IntakeCommitResponse> {
  const res = await fetch('/api/intake/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preview, rawText, userId }),
  });
  if (!res.ok) throw new Error('intake commit failed');
  return res.json() as Promise<IntakeCommitResponse>;
}
