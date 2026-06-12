/**
 * Synco Memory Loader
 *
 * Loads recent LearningEvent rows from PostgreSQL and maps them into
 * the SyncoMemory format expected by the brain pipeline.
 *
 * Design principles:
 * - mapLearningEventToSyncoMemory() is a pure function — testable without DB.
 * - loadBrainMemoriesForUser() always returns [] on any DB error (fail-open).
 * - Never modifies LearningEvent rows.
 * - Only reads eventTypes that carry behavioral signal for the brain.
 * - Skips task_rescheduled — needs burst-collapse policy first (per learningIntegrityGate).
 */

import { prisma } from '../../lib/prisma.js';
import type { SyncoMemory, MemorySource } from './syncoThinkingLayer.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Max events to load per request — keeps brain pipeline fast */
const DEFAULT_LIMIT = 50;

/** Look back this many days — older events have low recency value */
const DEFAULT_LOOKBACK_DAYS = 60;

/**
 * Event types that carry behavioral signal for the brain.
 * task_rescheduled is intentionally excluded (burst-collapse required).
 */
const BRAIN_RELEVANT_EVENT_TYPES = [
  'task_created',
  'task_completed',
  'task_execution_completed',
  'task_skipped',
  'task_postponed',
  'check_in_response',
  'preference_expressed',
] as const;

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Maps a LearningEvent `source` string to the SyncoMemory MemorySource union.
 * Falls back to "observed" for unknown values.
 */
function mapSource(rawSource: string | null | undefined): MemorySource {
  switch (rawSource) {
    case 'user':       return 'user_reported';
    case 'timer':      return 'timer_confirmed';
    case 'system':     return 'system_derived';
    case 'automation': return 'system_derived';
    case 'ai':         return 'ai_inferred';
    default:           return 'observed';
  }
}

/**
 * Assigns a baseline confidence to a memory based on eventType and source.
 * These are starting points — the EvidenceScoring module refines them further.
 */
function mapConfidence(eventType: string, source: MemorySource): number {
  const sourceBase: Partial<Record<MemorySource, number>> = {
    timer_confirmed: 0.90,
    observed:        0.80,
    system_derived:  0.75,
    user_reported:   0.60,
    ai_inferred:     0.50,
  };

  const typeModifier: Record<string, number> = {
    task_execution_completed: 0.05,   // confirmed by timer
    task_completed:           0.0,
    task_created:             -0.10,  // intent, not outcome
    task_skipped:             -0.05,
    task_postponed:           -0.05,
    check_in_response:        -0.10,  // user-reported state
    preference_expressed:     -0.15,  // subjective
  };

  const base = sourceBase[source] ?? 0.70;
  const mod  = typeModifier[eventType] ?? 0;
  return Math.max(0.10, Math.min(0.99, base + mod));
}

// ─── Pure mapping function ────────────────────────────────────────────────────

export interface RawLearningEvent {
  id: string;
  userId: string;
  taskId: string | null;
  eventType: string;
  source: string | null;
  occurredAt: Date;
  dateIso: string | null;
  taskTitleSnapshot: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: unknown;
}

/**
 * Pure function — maps one LearningEvent row to a SyncoMemory.
 * No DB call. Fully testable in isolation.
 */
export function mapLearningEventToSyncoMemory(event: RawLearningEvent): SyncoMemory {
  const source = mapSource(event.source);

  const metadata: Record<string, unknown> = {};
  if (event.metadata && typeof event.metadata === 'object') {
    Object.assign(metadata, event.metadata);
  }
  if (event.fromStatus) metadata.fromStatus = event.fromStatus;
  if (event.toStatus)   metadata.toStatus   = event.toStatus;
  if (event.taskId)     metadata.taskId     = event.taskId;
  if (event.dateIso)    metadata.dateIso    = event.dateIso;

  return {
    id:          event.id,
    userId:      event.userId,
    memoryKind:  event.eventType,
    entityType:  'task',
    entityId:    event.taskId ?? undefined,
    entityName:  event.taskTitleSnapshot ?? undefined,
    occurredAt:  event.occurredAt.toISOString(),
    source,
    confidence:  mapConfidence(event.eventType, source),
    metadata,
  };
}

/**
 * Maps a batch of LearningEvent rows to SyncoMemory[].
 * Pure function — no DB call.
 */
export function mapLearningEventsToBrainMemories(
  events: RawLearningEvent[]
): SyncoMemory[] {
  return events.map(mapLearningEventToSyncoMemory);
}

// ─── DB loader ────────────────────────────────────────────────────────────────

export interface MemoryLoadResult {
  memories: SyncoMemory[];
  count: number;
  source: 'real_db' | 'unavailable';
  error?: string;
}

/**
 * Loads recent brain-relevant LearningEvent rows for a user from PostgreSQL.
 * Returns { memories: [], source: 'unavailable' } on any DB error — never throws.
 */
export async function loadBrainMemoriesForUser(
  userId: string,
  opts: { limit?: number; lookbackDays?: number } = {}
): Promise<MemoryLoadResult> {
  const limit       = opts.limit       ?? DEFAULT_LIMIT;
  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.learningEvent.findMany({
      where: {
        userId,
        eventType: { in: [...BRAIN_RELEVANT_EVENT_TYPES] },
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        taskId: true,
        eventType: true,
        source: true,
        occurredAt: true,
        dateIso: true,
        taskTitleSnapshot: true,
        fromStatus: true,
        toStatus: true,
        metadata: true,
      },
    });

    const memories = mapLearningEventsToBrainMemories(rows);

    console.log(
      `[MemoryLoader] loaded ${memories.length} brain memories for user ${userId} (last ${lookbackDays}d)`
    );

    return { memories, count: memories.length, source: 'real_db' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn('[MemoryLoader] DB load failed, returning empty memories:', error);
    return { memories: [], count: 0, source: 'unavailable', error };
  }
}
