import type { DayCommandIntent, DayCommandOperation } from '../schemas/syncoAISchemas.js';

export interface ExistingTaskRef {
  id: string;
  title: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  warnings: string[];
  sanitized?: DayCommandIntent;
}

function slugMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

export function validateDayCommandIntent(
  intent: DayCommandIntent,
  existingTasks: ExistingTaskRef[],
  nowIso?: string
): ValidationResult {
  const warnings: string[] = [];
  const existingIds = new Set(existingTasks.map((t) => t.id));
  const now = nowIso ? new Date(nowIso) : new Date();

  // AI may return ok:false when it wants to ask a clarifying question or signal uncertainty.
  // Treat ok:false + ask_clarification (or questions present) as a valid clarification response.
  if (!intent.ok) {
    if (intent.commandType === 'ask_clarification' || intent.questions.length > 0) {
      return {
        ok: true,
        warnings,
        sanitized: {
          ...intent,
          ok: true,
          commandType: 'ask_clarification',
          requiresConfirmation: true,
          operations: [],
        },
      };
    }
    // True error: AI says ok:false without any clarification questions
    return { ok: false, reason: 'ai_returned_not_ok', warnings };
  }

  if (intent.confidence === 'low') {
    warnings.push('AI confidence is low — showing questions only');
    return {
      ok: true,
      warnings,
      sanitized: {
        ...intent,
        commandType: 'ask_clarification',
        requiresConfirmation: true,
        operations: [],
      },
    };
  }

  const sanitizedOps: DayCommandOperation[] = [];

  for (const op of intent.operations) {
    if (op.type === 'ask_question') {
      sanitizedOps.push(op);
      continue;
    }

    if (op.targetTaskId && !existingIds.has(op.targetTaskId)) {
      const titleHint = op.targetTaskTitle ?? '';
      const matches = existingTasks.filter((t) => slugMatch(t.title, titleHint));
      if (matches.length === 1) {
        warnings.push(
          `targetTaskId "${op.targetTaskId}" not found — resolved by title to "${matches[0].id}"`
        );
        sanitizedOps.push({
          ...op,
          targetTaskId: matches[0].id,
          targetTaskTitle: matches[0].title,
          targetConfidence: 'medium',
          requiresExplicitConfirm: true,
        });
      } else if (matches.length > 1) {
        warnings.push(
          `ambiguous target "${titleHint}" — ${matches.length} tasks match. Replaced with ask_question.`
        );
        sanitizedOps.push({
          operationId: op.operationId,
          type: 'ask_question',
          targetTaskId: null,
          targetTaskTitle: titleHint,
          targetConfidence: 'low',
          patch: null,
          newTask: null,
          recurrence: null,
          reason: `Ambiguous target "${titleHint}"`,
          riskLevel: 'medium',
          requiresExplicitConfirm: false,
        });
      } else {
        warnings.push(
          `targetTaskId "${op.targetTaskId}" not found and no title match — operation skipped.`
        );
        continue;
      }
      continue;
    }

    if (op.type === 'delete_task') {
      sanitizedOps.push({ ...op, requiresExplicitConfirm: true, riskLevel: 'high' });
      continue;
    }

    if (op.type === 'reschedule_task' && op.patch) {
      const newStart = op.patch['startTime'];
      if (typeof newStart === 'string') {
        const newStartDate = new Date(newStart);
        if (!isNaN(newStartDate.getTime()) && newStartDate < now) {
          warnings.push(
            `reschedule_task op "${op.operationId}" would schedule in the past — blocked.`
          );
          continue;
        }
      }
    }

    if (op.type === 'create_recurrence') {
      sanitizedOps.push({
        ...op,
        requiresExplicitConfirm: true,
        riskLevel: 'high',
      });
      continue;
    }

    const targetTask = op.targetTaskId
      ? existingTasks.find((t) => t.id === op.targetTaskId)
      : null;
    if (
      targetTask &&
      (targetTask.status === 'completed' || targetTask.status === 'not_completed') &&
      op.type !== 'ask_question'
    ) {
      warnings.push(
        `operation on completed/deleted task "${targetTask.title}" blocked unless explicit.`
      );
      sanitizedOps.push({ ...op, requiresExplicitConfirm: true });
      continue;
    }

    sanitizedOps.push(op);
  }

  return {
    ok: true,
    warnings,
    sanitized: { ...intent, operations: sanitizedOps },
  };
}

export function validateParsedPlanningIntent(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid_structure', warnings: [] };
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d['tasks'])) {
    return { ok: false, reason: 'missing_tasks_array', warnings: [] };
  }
  return { ok: true, warnings: [] };
}

export function validateTaskBreakdown(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid_structure', warnings: [] };
  }
  const d = data as Record<string, unknown>;
  if (typeof d['firstStep'] !== 'string' || !d['firstStep']) {
    return { ok: false, reason: 'missing_firstStep', warnings: [] };
  }
  return { ok: true, warnings: [] };
}
