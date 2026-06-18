import { prisma } from '../lib/prisma.js';
import { buildIntakePreview } from './intakeClassifier.js';
import type { IntakePreview } from './intakeClassifier.js';

export type { IntakePreview } from './intakeClassifier.js';

export async function organizeIntake(
  text: string,
  userId: string,
): Promise<IntakePreview> {
  if (!text || !text.trim()) {
    throw new Error('intake text is required');
  }
  return buildIntakePreview(text.trim());
}

export interface CommitResult {
  intakeId: string;
  taskIds: string[];
  projectId?: string;
  stepIds: string[];
}

export async function commitIntakePreview(
  userId: string,
  preview: IntakePreview,
  rawText: string,
): Promise<CommitResult> {
  const taskIds: string[] = [];
  let projectId: string | undefined;
  const stepIds: string[] = [];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Create IntakeRecord
    const intakeRecord = await tx.intakeRecord.create({
      data: {
        userId,
        rawText,
        parsedJson: preview as unknown as Record<string, unknown>,
        status: 'committed',
        committedAt: now,
      },
    });

    // 2. Create Project + ProjectSteps if type is 'project'
    if (preview.type === 'project' && preview.project) {
      const proj = await tx.project.create({
        data: {
          userId,
          title: preview.project.title,
          description: preview.project.description ?? null,
          goalText: preview.project.goalText ?? null,
          status: 'active',
          priority: 'medium',
        },
      });
      projectId = proj.id;

      for (const step of preview.project.steps) {
        const s = await tx.projectStep.create({
          data: {
            projectId: proj.id,
            title: step.title,
            orderIndex: step.orderIndex,
            status: 'pending',
          },
        });
        stepIds.push(s.id);
      }
    }

    // 3. Create UserTasks
    for (const task of preview.tasks) {
      const taskStart = new Date(now.getTime() + 60 * 60 * 1000); // 1h from now
      const taskEnd = new Date(taskStart.getTime() + 30 * 60 * 1000); // 30min
      const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await tx.userTask.create({
        data: {
          id,
          userId,
          title: task.title,
          startTime: taskStart,
          endTime: taskEnd,
          duration: 30,
          status: 'pending',
          priority: task.priority ?? 'medium',
          isAllDay: false,
          isRecurring: false,
          excludedDates: [],
          tagsJson: [],
          historyJson: [],
          createdFromJson: { source: 'intake', intakeId: intakeRecord.id },
          ...(projectId ? { projectId } : {}),
        },
      });
      taskIds.push(id);
    }

    return intakeRecord.id;
  });

  // intakeId is not directly accessible after transaction — re-query latest
  const latestIntake = await prisma.intakeRecord.findFirst({
    where: { userId, status: 'committed' },
    orderBy: { createdAt: 'desc' },
  });

  return {
    intakeId: latestIntake?.id ?? '',
    taskIds,
    projectId,
    stepIds,
  };
}
