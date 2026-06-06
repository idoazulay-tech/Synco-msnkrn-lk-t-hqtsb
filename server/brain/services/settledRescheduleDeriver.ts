/**
 * Synco Settled Reschedule Deriver — Phase 4a
 *
 * Produces exactly one factual Qdrant memory per settled reschedule burst.
 *
 * Design principles:
 *   - Never writes to Qdrant immediately — only after the burst window has elapsed
 *     and no later movement exists (settled condition verified at query time).
 *   - All raw task_rescheduled Postgres rows remain untouched.
 *   - Qdrant write uses a deterministic point ID → upsert is idempotent on retry.
 *   - settledMemoryWrittenAt is written to metadata ONLY after a successful Qdrant upsert.
 *   - Qdrant failure leaves the event eligible for retry on the next script run.
 *   - No behavioral conclusions. No postponement/avoidance/pattern inference.
 *   - Initial placement refinement events are explicitly skipped and marked.
 *   - Feature flag: SYNCO_SETTLED_DERIVATION_ENABLED=false → safe no-op.
 *
 * BURST_WINDOW_MS must stay aligned with rescheduleBurstDetector.ts.
 * Both are 5 * 60_000. Duplicated here intentionally to avoid circular imports.
 */

import { createHash } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { storeUserMessage } from './memory.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Must stay aligned with BURST_WINDOW_MS in rescheduleBurstDetector.ts.
 * Both are 5 * 60_000. Duplicated here to avoid a circular import chain.
 */
const BURST_WINDOW_MS = 5 * 60_000;

const SETTLED_RESCHEDULE_MEMORY_KIND = 'reschedule_settled' as const;
const SETTLED_RESCHEDULE_SCHEMA_VERSION = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SettledRescheduleEvent {
  id: string;
  userId: string;
  taskId: string | null;
  dateIso: string | null;
  occurredAt: Date;
  taskTitleSnapshot: string | null;
  fromStartTime: Date | null;
  toStartTime: Date | null;
  fromEndTime: Date | null;
  toEndTime: Date | null;
  metadata: Record<string, unknown>;
}

export interface SettledRescheduleMemory {
  pointId: string;
  memoryKind: typeof SETTLED_RESCHEDULE_MEMORY_KIND;
  schemaVersion: typeof SETTLED_RESCHEDULE_SCHEMA_VERSION;
  sourceLearningEventId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ProcessSettledResult {
  status: 'ok' | 'disabled';
  candidates: number;
  processed: number;
  skipped: number;
  errors: number;
}

export interface FindSettledOpts {
  taskId?: string;
  dateIso?: string;
  /** Maximum rows to fetch before in-memory filtering. Default: 200. */
  fetchLimit?: number;
}

// ─── Deterministic point ID ───────────────────────────────────────────────────

/**
 * Produces a stable UUID from (sourceLearningEventId, memoryKind, schemaVersion).
 * Identical to the pattern used in learningMemoryDerivation.ts — idempotent upserts.
 */
function deriveSettledPointId(
  sourceLearningEventId: string,
  memoryKind: string,
  schemaVersion: number,
): string {
  const identity = `${sourceLearningEventId}:${memoryKind}:v${schemaVersion}`;
  const hash = createHash('sha256').update(identity).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ─── Time formatting ──────────────────────────────────────────────────────────

/** Format a UTC Date as "HH:MM" using its UTC hours/minutes. */
function formatHHMM(dt: Date): string {
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─── 1. findSettledRescheduleEvents ──────────────────────────────────────────

/**
 * Returns task_rescheduled events that have fully settled and are eligible for
 * exactly one Qdrant factual memory.
 *
 * Eligibility criteria (all must pass):
 *   1. eventType = 'task_rescheduled'
 *   2. occurredAt < now - BURST_WINDOW_MS  (burst window has closed)
 *   3. metadata.burstRole is 'final' or 'sole'
 *   4. metadata.isInitialPlacementRefinement === false
 *   5. metadata.settledMemoryWrittenAt is absent
 *   6. No later task_rescheduled event exists for (userId, taskId, dateIso)
 *      within BURST_WINDOW_MS after this event
 *
 * Prisma Json field filtering is done in TypeScript after a bounded time-window
 * fetch, keeping the Prisma query simple and type-safe.
 */
export async function findSettledRescheduleEvents(
  userId: string,
  opts: FindSettledOpts = {},
): Promise<SettledRescheduleEvent[]> {

  const settledBefore = new Date(Date.now() - BURST_WINDOW_MS);
  const limit = opts.fetchLimit ?? 200;

  // ── Fetch candidates by time + userId + eventType ─────────────────────────
  const candidates = await prisma.learningEvent.findMany({
    where: {
      userId,
      eventType:  'task_rescheduled',
      occurredAt: { lt: settledBefore },
      ...(opts.taskId  ? { taskId:  opts.taskId  } : {}),
      ...(opts.dateIso ? { dateIso: opts.dateIso } : {}),
    },
    orderBy: { occurredAt: 'asc' },
    take:    limit,
    select: {
      id:                true,
      userId:            true,
      taskId:            true,
      dateIso:           true,
      occurredAt:        true,
      taskTitleSnapshot: true,
      fromStartTime:     true,
      toStartTime:       true,
      fromEndTime:       true,
      toEndTime:         true,
      metadata:          true,
    },
  });

  // ── Filter metadata in TypeScript ─────────────────────────────────────────
  const eligible = candidates.filter(row => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const burstRole = meta.burstRole;
    const isInitialPlacement = meta.isInitialPlacementRefinement;
    const alreadyWritten = meta.settledMemoryWrittenAt;
    const alreadySkipped = meta.placementRefinementSkippedAt;

    if (burstRole !== 'final' && burstRole !== 'sole') return false;
    if (isInitialPlacement === true) return false;
    if (alreadyWritten) return false;
    if (alreadySkipped) return false;
    return true;
  });

  if (eligible.length === 0) return [];

  // ── Verify "no later movement" for each eligible candidate ────────────────
  const settled: SettledRescheduleEvent[] = [];

  for (const row of eligible) {
    const windowEnd = new Date(row.occurredAt.getTime() + BURST_WINDOW_MS);

    const laterWhere: Parameters<typeof prisma.learningEvent.findFirst>[0]['where'] = {
      id:        { not: row.id },
      userId:    row.userId,
      taskId:    row.taskId ?? undefined,
      eventType: 'task_rescheduled',
      occurredAt: {
        gt: row.occurredAt,
        lte: windowEnd,
      },
    };
    if (row.dateIso != null) {
      laterWhere.dateIso = row.dateIso;
    }

    const laterEvent = await prisma.learningEvent.findFirst({
      where:  laterWhere,
      select: { id: true },
    });

    if (!laterEvent) {
      settled.push({
        id:                row.id,
        userId:            row.userId,
        taskId:            row.taskId,
        dateIso:           row.dateIso,
        occurredAt:        row.occurredAt,
        taskTitleSnapshot: row.taskTitleSnapshot,
        fromStartTime:     row.fromStartTime,
        toStartTime:       row.toStartTime,
        fromEndTime:       row.fromEndTime,
        toEndTime:         row.toEndTime,
        metadata:          (row.metadata ?? {}) as Record<string, unknown>,
      });
    }
  }

  return settled;
}

// ─── 2. buildSettledRescheduleMemory ─────────────────────────────────────────

/**
 * Builds a factual Qdrant memory for a settled reschedule event.
 * Returns null when the event does not qualify (safety guard).
 *
 * Memory text is positional fact only — no behavioral inference.
 * Forbidden words are never written: דחה, נמנע, מתקשה, כשל, בעיה, דחיינות,
 * procrastination, avoidance, postponement, planning_failure, delay_pattern.
 */
export function buildSettledRescheduleMemory(
  event: SettledRescheduleEvent,
): SettledRescheduleMemory | null {

  const meta = event.metadata;
  const burstRole = meta.burstRole;
  const isInitialPlacement = meta.isInitialPlacementRefinement;

  // ── Safety guards ─────────────────────────────────────────────────────────
  if (burstRole !== 'final' && burstRole !== 'sole') return null;
  if (isInitialPlacement === true) return null;
  if (!event.taskTitleSnapshot?.trim()) return null;

  const title   = event.taskTitleSnapshot.trim();
  const dateIso = event.dateIso ?? '';

  // ── Factual positional memory text ────────────────────────────────────────
  let content: string;
  if (event.fromStartTime && event.toStartTime) {
    const from = formatHHMM(event.fromStartTime);
    const to   = formatHHMM(event.toStartTime);
    content = `המשתמש שינה את זמן המשימה ${title} מ־${from} ל־${to} בתאריך ${dateIso}.`;
  } else {
    content = `המשתמש שינה את זמן המשימה ${title} בתאריך ${dateIso}.`;
  }

  // ── Deterministic point ID ────────────────────────────────────────────────
  const pointId = deriveSettledPointId(
    event.id,
    SETTLED_RESCHEDULE_MEMORY_KIND,
    SETTLED_RESCHEDULE_SCHEMA_VERSION,
  );

  // ── Qdrant metadata ───────────────────────────────────────────────────────
  const qdrantMetadata: Record<string, unknown> = {
    source:                       'learning_event',
    memoryKind:                   SETTLED_RESCHEDULE_MEMORY_KIND,
    schemaVersion:                SETTLED_RESCHEDULE_SCHEMA_VERSION,
    integrityStatus:              'accepted_fact',
    status:                       'active',
    eventType:                    'task_rescheduled',
    burstRole:                    burstRole,
    isInitialPlacementRefinement: false,
    evidenceType:                 'settled_reschedule_burst',
    sourceLearningEventId:        event.id,
    taskId:                       event.taskId    ?? null,
    dateIso:                      event.dateIso   ?? null,
    fromStartTime:                event.fromStartTime?.toISOString() ?? null,
    toStartTime:                  event.toStartTime?.toISOString()   ?? null,
    fromEndTime:                  event.fromEndTime?.toISOString()   ?? null,
    toEndTime:                    event.toEndTime?.toISOString()     ?? null,
    importance:                   'low',
  };

  return {
    pointId,
    memoryKind:            SETTLED_RESCHEDULE_MEMORY_KIND,
    schemaVersion:         SETTLED_RESCHEDULE_SCHEMA_VERSION,
    sourceLearningEventId: event.id,
    content,
    metadata:              qdrantMetadata,
  };
}

// ─── 3. processSettledReschedules ────────────────────────────────────────────

/**
 * Orchestrates find → build → Qdrant write → Postgres metadata update.
 *
 * Qdrant write ordering rule:
 *   settledMemoryWrittenAt is written ONLY after a successful storeUserMessage call.
 *   A Qdrant failure leaves the event eligible for retry on the next run.
 *
 * Returns a safe summary with no private task content.
 */
export async function processSettledReschedules(
  userId: string,
  opts: FindSettledOpts = {},
): Promise<ProcessSettledResult> {

  if (process.env.SYNCO_SETTLED_DERIVATION_ENABLED === 'false') {
    return { status: 'disabled', candidates: 0, processed: 0, skipped: 0, errors: 0 };
  }

  const candidates = await findSettledRescheduleEvents(userId, opts);
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of candidates) {
    const meta = event.metadata;
    const isInitialPlacement = meta.isInitialPlacementRefinement;

    // ── Handle initial placement refinement (skip + mark) ─────────────────
    if (isInitialPlacement === true) {
      await safeUpdateMetadata(event.id, event.metadata, {
        placementRefinementSkippedAt:  new Date().toISOString(),
        settledMemorySkipReason:       'initial_placement_refinement',
      });
      skipped++;
      continue;
    }

    const memory = buildSettledRescheduleMemory(event);

    if (!memory) {
      skipped++;
      continue;
    }

    // ── Qdrant write ──────────────────────────────────────────────────────
    try {
      await storeUserMessage(event.userId, memory.content, {
        ...memory.metadata,
        pointId: memory.pointId,
      });

      // Only write the Postgres marker after Qdrant succeeds.
      await safeUpdateMetadata(event.id, event.metadata, {
        settledMemoryWrittenAt:  new Date().toISOString(),
        settledMemoryKind:       SETTLED_RESCHEDULE_MEMORY_KIND,
        settledMemoryPointId:    memory.pointId,
      });

      processed++;
    } catch (err: unknown) {
      // Do NOT write settledMemoryWrittenAt — event remains eligible for retry.
      console.warn('[SettledRescheduleDeriver] qdrant_write_failed', {
        eventId:   event.id,
        taskId:    event.taskId,
        userId:    event.userId,
        dateIso:   event.dateIso,
        pointId:   memory.pointId,
        error:     err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  return {
    status:     'ok',
    candidates: candidates.length,
    processed,
    skipped,
    errors,
  };
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function safeUpdateMetadata(
  eventId: string,
  currentMetadata: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  const merged = { ...currentMetadata, ...patch };
  await prisma.learningEvent.update({
    where: { id: eventId },
    data:  { metadata: merged },
  });
}
