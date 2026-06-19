import { prisma } from '../lib/prisma.js';
import { understandIntake } from './intakeUnderstandingService.js';
import type { SyncoIntakePreview } from './intakeUnderstandingService.js';

export type { SyncoIntakePreview } from './intakeUnderstandingService.js';
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
  // Legacy flat fields (backward compat)
  intakeId: string;
  taskIds: string[];
  projectIds: string[];
  stepIds: string[];
  nowTaskId: string | null;
  // Spec-required nested shape
  created: {
    intakeId: string;
    projectIds: string[];
    taskIds: string[];
    stepIds: string[];
    openQuestionIds: string[];
  };
}

export async function commitIntakePreview(
  userId: string,
  preview: SyncoIntakePreview,
  rawText: string,
): Promise<CommitResult> {
  const taskIds: string[] = [];
  const projectIds: string[] = [];
  const stepIds: string[] = [];
  let nowTaskId: string | null = null;
  const now = new Date();

  // tempId → real DB project id
  const projectIdMap: Record<string, string> = {};

  // tempId → (step title → step DB id) for task→step linking
  const stepTitleToId: Record<string, Record<string, string>> = {};

  // tempId → first step id (step at orderIndex 0)
  const firstStepIds: Record<string, string> = {};

  // ── Transaction ───────────────────────────────────────────────────────────────

  const intakeId = await prisma.$transaction(async (tx) => {

    // 1. IntakeRecord — store the full preview JSON as the canonical record
    const intakeRecord = await tx.intakeRecord.create({
      data: {
        userId,
        rawText,
        parsedJson: preview as unknown as Record<string, unknown>,
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
      stepTitleToId[proj.tempId] = {};

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
        stepTitleToId[proj.tempId][step.title] = s.id;
        // Always set firstStepIds to the first created step;
        // override with the step whose orderIndex is 0 when found
        if (!firstStepIds[proj.tempId] || step.orderIndex === 0) {
          firstStepIds[proj.tempId] = s.id;
        }
      }
    }

    // ── Helper: find the best ProjectStep id for a task ──────────────────────
    function resolveStepId(
      title: string,
      linkedProjectTempId?: string,
    ): string | undefined {
      if (!linkedProjectTempId) return undefined;
      const trimmed = title.trim();
      // 1. Exact title match in linked project
      const byTitle = stepTitleToId[linkedProjectTempId]?.[trimmed];
      if (byTitle) return byTitle;
      // 2. First step of linked project (nowAction is typically step 0)
      const firstStep = firstStepIds[linkedProjectTempId];
      if (firstStep) return firstStep;
      // 3. Search all created projects for a step matching this title
      for (const projTempId of Object.keys(stepTitleToId)) {
        const anyMatch = stepTitleToId[projTempId][trimmed];
        if (anyMatch) return anyMatch;
      }
      return undefined;
    }

    // ── Helper: create a single UserTask ─────────────────────────────────────
    async function createTask(opts: {
      title: string;
      priority: 'high' | 'medium' | 'low';
      linkedProjectTempId?: string;
      firstStepText?: string;
      startOffsetMs: number;
      source: string;
    }): Promise<string> {
      const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const durationMin = opts.priority === 'high' ? 60 : 30;
      const taskStart = new Date(now.getTime() + opts.startOffsetMs);
      const taskEnd   = new Date(taskStart.getTime() + durationMin * 60 * 1000);
      const realProjectId = opts.linkedProjectTempId
        ? projectIdMap[opts.linkedProjectTempId]
        : undefined;
      const stepId = resolveStepId(opts.title, opts.linkedProjectTempId);

      await tx.userTask.create({
        data: {
          id,
          userId,
          title:       opts.title,
          startTime:   taskStart,
          endTime:     taskEnd,
          duration:    durationMin,
          status:      'pending',
          priority:    opts.priority,
          isAllDay:    false,
          isRecurring: false,
          excludedDates: [],
          tagsJson:    [],
          historyJson: [],
          createdFromJson: {
            source:       opts.source,
            intakeId:     intakeRecord.id,
            originalText: rawText.slice(0, 200),
          },
          ...(realProjectId    ? { projectId:     realProjectId } : {}),
          ...(stepId           ? { projectStepId: stepId        } : {}),
          ...(opts.firstStepText ? { firstStep:   opts.firstStepText } : {}),
        },
      });

      // Back-link: update ProjectStep.taskId to point to this task
      if (stepId) {
        await tx.projectStep.update({
          where: { id: stepId },
          data:  { taskId: id },
        });
      }

      return id;
    }

    // 3. nowAction task
    if (preview.nowAction) {
      const id = await createTask({
        title:               preview.nowAction.title,
        priority:            preview.nowAction.priority,
        linkedProjectTempId: preview.nowAction.linkedProjectTempId,
        firstStepText:       preview.nowAction.firstStep,
        startOffsetMs:       60 * 60 * 1000,  // 1 hour from now
        source:              'intake_now',
      });
      taskIds.push(id);
      nowTaskId = id;
    }

    // 4. todayTasks (skip exact duplicates of nowAction title)
    const seenTitles = new Set<string>(
      preview.nowAction ? [preview.nowAction.title] : [],
    );

    for (const task of preview.todayTasks) {
      if (!task.title || seenTitles.has(task.title)) continue;
      seenTitles.add(task.title);
      const id = await createTask({
        title:               task.title,
        priority:            task.priority ?? 'medium',
        linkedProjectTempId: task.linkedProjectTempId,
        firstStepText:       task.firstStep,
        startOffsetMs:       90 * 60 * 1000,  // 1.5 hours from now
        source:              'intake',
      });
      taskIds.push(id);
    }

    // 5. laterTasks
    for (const task of preview.laterTasks) {
      if (!task.title || seenTitles.has(task.title)) continue;
      seenTitles.add(task.title);
      const id = await createTask({
        title:               task.title,
        priority:            'low',
        linkedProjectTempId: task.linkedProjectTempId,
        firstStepText:       task.firstStep,
        startOffsetMs:       24 * 60 * 60 * 1000,  // tomorrow
        source:              'intake_later',
      });
      taskIds.push(id);
    }

    return intakeRecord.id;
  });

  // ── Build return value ────────────────────────────────────────────────────────

  const created = {
    intakeId,
    projectIds: [...projectIds],
    taskIds:    [...taskIds],
    stepIds:    [...stepIds],
    openQuestionIds: [],
  };

  return {
    intakeId,
    taskIds,
    projectIds,
    stepIds,
    nowTaskId,
    created,
  };
}
