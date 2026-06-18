import { prisma } from '../lib/prisma.js';
import { understandIntake } from './intakeUnderstandingService.js';
import type { SyncoIntakePreview } from './intakeUnderstandingService.js';

export type { SyncoIntakePreview } from './intakeUnderstandingService.js';

// Legacy shim for any code that imports the old IntakePreview type
export type { IntakePreview } from './intakeDeterministicParser.js';

export async function organizeIntake(
  text: string,
  userId: string,
): Promise<SyncoIntakePreview> {
  if (!text || !text.trim()) {
    throw new Error('intake text is required');
  }
  const result = await understandIntake(text.trim(), userId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _source: _s, ...preview } = result as SyncoIntakePreview & { _source: string };
  return preview;
}

export interface CommitResult {
  intakeId: string;
  taskIds: string[];
  projectIds: string[];
  stepIds: string[];
}

export async function commitIntakePreview(
  userId: string,
  preview: SyncoIntakePreview,
  rawText: string,
): Promise<CommitResult> {
  const taskIds: string[] = [];
  const projectIds: string[] = [];
  const stepIds: string[] = [];
  const now = new Date();

  // tempId → real DB project id
  const projectIdMap: Record<string, string> = {};

  await prisma.$transaction(async (tx) => {
    // 1. IntakeRecord
    const intakeRecord = await tx.intakeRecord.create({
      data: {
        userId,
        rawText,
        parsedJson: {
          notes:         preview.notes,
          entities:      preview.entities,
          openQuestions: preview.openQuestions,
          warnings:      preview.warnings,
          projectCount:  preview.projects.length,
          taskCount:     preview.todayTasks.length + preview.laterTasks.length,
          nowActionTitle: preview.nowAction?.title ?? null,
        } as unknown as Record<string, unknown>,
        status:      'committed',
        committedAt: now,
      },
    });

    // 2. Projects + Steps
    for (const proj of preview.projects) {
      const dbProj = await tx.project.create({
        data: {
          userId,
          title:       proj.title,
          description: proj.goal,
          goalText:    proj.goal,
          status:      'active',
          priority:    proj.priority ?? 'medium',
        },
      });
      projectIds.push(dbProj.id);
      projectIdMap[proj.tempId] = dbProj.id;

      for (const step of proj.steps) {
        const s = await tx.projectStep.create({
          data: {
            projectId:  dbProj.id,
            title:      step.title,
            orderIndex: step.orderIndex,
            status:     'pending',
          },
        });
        stepIds.push(s.id);
      }
    }

    // 3. nowAction task (if present and not already in todayTasks)
    const nowTitle = preview.nowAction?.title;

    // 4. todayTasks + nowAction
    const allTasks = [
      ...(preview.nowAction ? [{ title: nowTitle!, priority: preview.nowAction.priority, linkedProjectTempId: preview.nowAction.linkedProjectTempId, isNow: true }] : []),
      ...preview.todayTasks.map(t => ({ ...t, isNow: false })),
    ];

    // Deduplicate by title
    const seenTitles = new Set<string>();
    for (const task of allTasks) {
      if (!task.title || seenTitles.has(task.title)) continue;
      seenTitles.add(task.title);

      const taskStart = new Date(now.getTime() + 60 * 60 * 1000);
      const taskEnd   = new Date(taskStart.getTime() + (task.priority === 'high' ? 60 : 30) * 60 * 1000);
      const id        = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const realProjectId = task.linkedProjectTempId ? projectIdMap[task.linkedProjectTempId] : undefined;

      await tx.userTask.create({
        data: {
          id,
          userId,
          title:       task.title,
          startTime:   taskStart,
          endTime:     taskEnd,
          duration:    task.priority === 'high' ? 60 : 30,
          status:      'pending',
          priority:    task.priority ?? 'medium',
          isAllDay:    false,
          isRecurring: false,
          excludedDates: [],
          tagsJson:    [],
          historyJson: [],
          createdFromJson: { source: 'intake', intakeId: intakeRecord.id },
          ...(realProjectId ? { projectId: realProjectId } : {}),
        },
      });
      taskIds.push(id);
    }

    // 5. laterTasks
    for (const task of preview.laterTasks) {
      if (!task.title || seenTitles.has(task.title)) continue;
      seenTitles.add(task.title);

      const taskStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const taskEnd   = new Date(taskStart.getTime() + 30 * 60 * 1000);
      const id        = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const realProjectId = task.linkedProjectTempId ? projectIdMap[task.linkedProjectTempId] : undefined;

      await tx.userTask.create({
        data: {
          id,
          userId,
          title:       task.title,
          startTime:   taskStart,
          endTime:     taskEnd,
          duration:    30,
          status:      'pending',
          priority:    'low',
          isAllDay:    false,
          isRecurring: false,
          excludedDates: [],
          tagsJson:    [],
          historyJson: [],
          createdFromJson: { source: 'intake_later', intakeId: intakeRecord.id },
          ...(realProjectId ? { projectId: realProjectId } : {}),
        },
      });
      taskIds.push(id);
    }

    return intakeRecord.id;
  });

  return { intakeId: '', taskIds, projectIds, stepIds };
}
