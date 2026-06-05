/**
 * Synco Learning Integrity Gate — Phase 1
 *
 * Contextual duplicate detection for high-value learning events.
 * Runs AFTER Postgres LearningEvent.create() succeeds and BEFORE the Memory
 * Derivation Engine writes to Qdrant.
 *
 * Problem:
 *   Deterministic Qdrant point IDs prevent exact-retry duplicates (same
 *   sourceLearningEventId). They do NOT prevent contextual duplicates where
 *   different LearningEvent rows (different cuid IDs) represent the same user
 *   action — e.g. a double-click on "סיימתי" that produces two task_completed
 *   rows seconds apart.
 *
 * Design principles:
 *   - Raw Postgres events are NEVER deleted or suppressed — this gate only
 *     controls whether derived Qdrant memories are written.
 *   - Fail-open: any gate error → return 'accepted' so real events are never
 *     silently swallowed by infrastructure bugs.
 *   - No private task content is logged — only IDs, types, and timing.
 *   - Feature flag: SYNCO_INTEGRITY_GATE_ENABLED=false → bypass entirely.
 *
 * Recurring-task protection:
 *   For event types that use dateIso matching (task_completed,
 *   task_execution_completed), two events for the same taskId on DIFFERENT
 *   dates are treated as distinct occurrences and are both accepted.
 *
 * Excluded event types:
 *   task_rescheduled is intentionally excluded — it requires a burst-collapse
 *   policy before any dedup or derivation logic is applied.
 */

import { prisma } from '../../lib/prisma.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningIntegrityStatus = 'accepted' | 'duplicate_ignored';

export interface LearningIntegrityGateResult {
  status: LearningIntegrityStatus;
  priorEventId?: string;
  windowMs?: number;
  occurredAtDiffMs?: number;
  reason?: string;
}

/** Minimal shape of a saved LearningEvent needed by the gate. */
interface GateEventInput {
  id: string;
  userId: string;
  taskId: string | null;
  eventType: string;
  dateIso: string | null;
  occurredAt: Date;
}

// ─── Gate configuration ───────────────────────────────────────────────────────

interface GateConfig {
  /** How far back to look for a prior duplicate event (ms). */
  windowMs: number;
  /**
   * When true, two events for the same taskId/eventType are only considered
   * duplicates if they share the same dateIso. This protects recurring-task
   * completions: same taskId on different calendar dates = different occurrences.
   *
   * If useDateIso is true but the event's dateIso is null, the gate still runs
   * using userId + taskId + eventType + time window — it does not skip the check.
   */
  useDateIso: boolean;
}

const GATE_CONFIG: Partial<Record<string, GateConfig>> = {
  task_completed: {
    windowMs:   3_000,
    useDateIso: true,
  },
  task_execution_completed: {
    windowMs:   5_000,
    useDateIso: true,
  },
  task_created: {
    windowMs:   3_000,
    useDateIso: false,
  },
};

// ─── Gate function ────────────────────────────────────────────────────────────

/**
 * Runs the contextual duplicate gate against a just-saved LearningEvent.
 *
 * Returns 'accepted' when:
 *   - The feature flag is disabled.
 *   - The event type is not in the gate config.
 *   - The event has no taskId (no dedup key).
 *   - No matching prior event is found within the dedup window.
 *   - Any Prisma / infrastructure error occurs (fail-open).
 *
 * Returns 'duplicate_ignored' when:
 *   - A prior LearningEvent with the same (userId, taskId, eventType, [dateIso])
 *     exists within the configured time window before this event.
 */
export async function runContextualDuplicateGate(
  event: GateEventInput,
): Promise<LearningIntegrityGateResult> {

  // ── Feature flag ──────────────────────────────────────────────────────────
  if (process.env.SYNCO_INTEGRITY_GATE_ENABLED === 'false') {
    return { status: 'accepted', reason: 'disabled' };
  }

  // ── Event type in config? ─────────────────────────────────────────────────
  const config = GATE_CONFIG[event.eventType];
  if (!config) {
    return { status: 'accepted', reason: 'event_not_gated' };
  }

  // ── taskId required for dedup key ─────────────────────────────────────────
  if (!event.taskId) {
    return { status: 'accepted', reason: 'missing_task_id' };
  }

  const { windowMs, useDateIso } = config;
  const windowStart = new Date(event.occurredAt.getTime() - windowMs);

  try {
    // ── Build Prisma filter ────────────────────────────────────────────────
    const where: Parameters<typeof prisma.learningEvent.findFirst>[0]['where'] = {
      id:        { not: event.id },
      userId:    event.userId,
      taskId:    event.taskId,
      eventType: event.eventType,
      occurredAt: {
        gte: windowStart,
        lt:  event.occurredAt,
      },
    };

    // Apply dateIso filter for recurring-task protection when applicable.
    // If dateIso is missing, we still run the gate without it — missing dateIso
    // is not grounds to skip the duplicate check; it just widens the match.
    if (useDateIso && event.dateIso != null) {
      where.dateIso = event.dateIso;
    }

    const prior = await prisma.learningEvent.findFirst({
      where,
      orderBy: { occurredAt: 'desc' },
      select:  { id: true, occurredAt: true },
    });

    if (prior) {
      const occurredAtDiffMs = event.occurredAt.getTime() - prior.occurredAt.getTime();
      return {
        status:           'duplicate_ignored',
        priorEventId:      prior.id,
        windowMs,
        occurredAtDiffMs,
      };
    }

    return { status: 'accepted' };

  } catch (err: unknown) {
    // Fail-open: never suppress a real event due to a gate infrastructure error.
    console.warn('[LearningIntegrityGate] gate_error_fail_open', {
      eventId:   event.id,
      userId:    event.userId,
      taskId:    event.taskId,
      eventType: event.eventType,
      dateIso:   event.dateIso,
      error:     err instanceof Error ? err.message : String(err),
    });
    return { status: 'accepted', reason: 'gate_error_fail_open' };
  }
}
