/**
 * metricsTrackingService.ts
 *
 * Single safe helper for tracking product-level events.
 * Uses LearningEvent (metadata field) — no new DB table needed.
 *
 * Contract:
 *   - Never throws. All errors are logged and swallowed (fire-and-forget).
 *   - Stores projectId / intakeId in metadata alongside any caller-supplied fields.
 *   - Does not duplicate existing task_created / task_completed events; only
 *     tracks new intake / project / flow events defined in the taxonomy below.
 *
 * Taxonomy (eventType values):
 *   Intake:        intake_previewed | intake_committed | intake_commit_failed
 *   Preview:       intake_now_action_created | intake_project_detected |
 *                  intake_note_detected | intake_open_question_created
 *   Now flow:      now_action_recommended | now_action_started |
 *                  now_action_completed | now_action_stuck |
 *                  now_action_skipped | reflection_shown | next_action_clicked
 *   Projects:      project_created_from_intake | project_step_created |
 *                  project_task_linked | project_step_completed
 *   User value:    chaos_to_action_started | chaos_to_action_completed
 */

import { prisma } from '../lib/prisma.js';

export interface ProductEventInput {
  userId: string;
  eventType: string;
  source?: string;
  occurredAt?: Date;
  taskId?: string;
  projectId?: string;
  intakeId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackProductEvent(input: ProductEventInput): Promise<void> {
  try {
    const meta: Record<string, unknown> = { ...(input.metadata ?? {}) };
    if (input.projectId) meta.projectId = input.projectId;
    if (input.intakeId)  meta.intakeId  = input.intakeId;

    await prisma.learningEvent.create({
      data: {
        userId:    input.userId,
        taskId:    input.taskId  ?? null,
        eventType: input.eventType,
        source:    input.source  ?? 'intake',
        occurredAt: input.occurredAt ?? new Date(),
        metadata:  meta,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[metricsTracking] ${input.eventType}`, msg);
  }
}
