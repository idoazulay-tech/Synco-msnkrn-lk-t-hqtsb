/**
 * Synco Reschedule Burst Detector — Phase 3
 *
 * Annotates raw task_rescheduled Postgres rows with burst membership metadata
 * and initial-placement-refinement metadata.
 *
 * Design principles:
 *   - Every raw task_rescheduled event is ALWAYS preserved in Postgres unchanged.
 *   - Annotation is written into the existing metadata: Json? field — no schema change.
 *   - Zero Qdrant writes occur here — this is raw-data quality annotation only.
 *   - Fire-and-forget: annotation failure never blocks the HTTP response.
 *   - No behavioral conclusions inferred (no postponement, avoidance, pattern labels).
 *   - Feature flag: SYNCO_BURST_DETECTION_ENABLED=false → skip entirely.
 *
 * burstRole semantics:
 *   'sole'   — only movement in the burst window; not part of any group.
 *   'member' — intermediate movement within a burst; not the latest known.
 *   'final'  — currently latest movement in a burst. May be updated to 'member'
 *              when the next movement arrives within the window.
 *
 * isInitialPlacementRefinement semantics:
 *   true  — task was moved within 5 minutes of its creation time.
 *           Factual observation only. Does NOT imply avoidance, postponement,
 *           planning failure, or any behavioral pattern.
 *   false — task was moved more than 5 minutes after creation, or taskCreatedAt
 *           was unavailable.
 */

import { prisma } from '../../lib/prisma.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Sliding backward window for grouping movements into one editing burst. */
export const BURST_WINDOW_MS = 5 * 60_000; // 5 minutes

/**
 * Window for classifying a movement as "initial placement refinement."
 * If the task was moved within this many ms of its creation time, the user
 * was likely still finding the right slot — not rescheduling an established plan.
 */
export const INITIAL_PLACEMENT_WINDOW_MS = 5 * 60_000; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export type BurstRole = 'sole' | 'member' | 'final';

export interface RescheduleBurstContext {
  /** IDs of prior burst events found within the window (ascending by occurredAt). */
  priorBurstEventIds: string[];
  /** True if prior events exist in the window — current event is not the first. */
  isBurstMember: boolean;
  /** True when task was moved within 5 min of its creation (initial slot-finding). */
  isInitialPlacementRefinement: boolean;
  /** The burstRole assigned to the current event. */
  burstRole: BurstRole;
}

/** Minimal shape of the event passed from the route handler. */
export interface BurstDetectorEventInput {
  id: string;
  userId: string;
  taskId: string | null;
  eventType: string;
  dateIso: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown> | null;
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Queries Postgres for prior task_rescheduled events within the burst window
 * for the same (userId, taskId, dateIso) and computes burst membership context.
 *
 * Does NOT write anything. Safe to call independently.
 */
export async function detectRescheduleBurstContext(
  event: BurstDetectorEventInput,
): Promise<RescheduleBurstContext> {

  // ── isInitialPlacementRefinement ─────────────────────────────────────────
  let isInitialPlacementRefinement = false;
  const taskCreatedAtRaw = event.metadata?.taskCreatedAt;
  if (typeof taskCreatedAtRaw === 'string') {
    const taskCreatedAtMs = Date.parse(taskCreatedAtRaw);
    if (!isNaN(taskCreatedAtMs)) {
      isInitialPlacementRefinement =
        event.occurredAt.getTime() - taskCreatedAtMs <= INITIAL_PLACEMENT_WINDOW_MS;
    }
  }

  // ── Prior burst events ───────────────────────────────────────────────────
  const windowStart = new Date(event.occurredAt.getTime() - BURST_WINDOW_MS);

  const where: Parameters<typeof prisma.learningEvent.findMany>[0]['where'] = {
    id:        { not: event.id },
    userId:    event.userId,
    taskId:    event.taskId ?? undefined,
    eventType: 'task_rescheduled',
    occurredAt: {
      gte: windowStart,
      lt:  event.occurredAt,
    },
  };

  // Apply dateIso filter only when present — degrades gracefully for legacy events.
  if (event.dateIso != null) {
    where.dateIso = event.dateIso;
  }

  const priorEvents = await prisma.learningEvent.findMany({
    where,
    orderBy: { occurredAt: 'asc' },
    select:  { id: true },
  });

  const priorBurstEventIds = priorEvents.map(e => e.id);
  const isBurstMember = priorBurstEventIds.length > 0;
  const burstRole: BurstRole = isBurstMember ? 'final' : 'sole';

  return { priorBurstEventIds, isBurstMember, isInitialPlacementRefinement, burstRole };
}

// ─── Annotation ───────────────────────────────────────────────────────────────

/**
 * Detects burst context and writes burst metadata annotations to Postgres.
 *
 * Current event: annotated with { burstRole, isInitialPlacementRefinement, burstWindowMs, burstDetectedAt }.
 * Prior burst events: updated to { burstRole: 'member' }.
 *
 * All existing metadata fields are preserved (read-then-write pattern).
 * Fire-and-forget — caller should not await this; all errors are caught internally.
 */
export async function annotateRescheduleBurst(
  event: BurstDetectorEventInput,
): Promise<void> {

  // ── Feature flag ──────────────────────────────────────────────────────────
  if (process.env.SYNCO_BURST_DETECTION_ENABLED === 'false') {
    return;
  }

  // ── Only handle task_rescheduled ─────────────────────────────────────────
  if (event.eventType !== 'task_rescheduled') {
    return;
  }

  // ── taskId required ───────────────────────────────────────────────────────
  if (!event.taskId) {
    // Cannot group without a task identifier — annotate minimally and return.
    await safeUpdateMetadata(event.id, event.metadata, {
      burstRole:                    'sole',
      isInitialPlacementRefinement: false,
      burstWindowMs:                BURST_WINDOW_MS,
      burstDetectedAt:              new Date().toISOString(),
      burstNote:                    'missing_task_id',
    });
    return;
  }

  const detectedAt = new Date().toISOString();

  try {
    const ctx = await detectRescheduleBurstContext(event);

    // ── Annotate current event ─────────────────────────────────────────────
    await safeUpdateMetadata(event.id, event.metadata, {
      burstRole:                    ctx.burstRole,
      isInitialPlacementRefinement: ctx.isInitialPlacementRefinement,
      burstWindowMs:                BURST_WINDOW_MS,
      burstDetectedAt:              detectedAt,
    });

    // ── Update prior events to 'member' ───────────────────────────────────
    // Each prior event gets its burstRole updated to 'member'.
    // We must read each one's existing metadata to preserve it (Json replace semantics).
    if (ctx.priorBurstEventIds.length > 0) {
      const priors = await prisma.learningEvent.findMany({
        where:  { id: { in: ctx.priorBurstEventIds } },
        select: { id: true, metadata: true },
      });

      await Promise.all(
        priors.map(prior =>
          safeUpdateMetadata(prior.id, prior.metadata as Record<string, unknown> | null, {
            burstRole:       'member',
            burstWindowMs:   BURST_WINDOW_MS,
            burstDetectedAt: detectedAt,
          }),
        ),
      );
    }

  } catch (err: unknown) {
    // Annotation failure must never surface to the caller or change API response.
    console.warn('[RescheduleBurstDetector] annotation_failed', {
      eventId:   event.id,
      taskId:    event.taskId,
      userId:    event.userId,
      dateIso:   event.dateIso,
      error:     err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Merges annotation fields into an event's metadata via a read-then-write.
 * Preserves all pre-existing fields (duration, priority, flexibility, taskCreatedAt, etc.).
 */
async function safeUpdateMetadata(
  eventId: string,
  currentMetadata: Record<string, unknown> | null,
  annotation: Record<string, unknown>,
): Promise<void> {
  const merged = {
    ...(currentMetadata ?? {}),
    ...annotation,
  };
  await prisma.learningEvent.update({
    where: { id: eventId },
    data:  { metadata: merged },
  });
}
