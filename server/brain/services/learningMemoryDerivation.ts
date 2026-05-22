/**
 * Synco Memory Derivation Engine — Foundation Layer
 *
 * One meaningful user activity may produce multiple distinct factual derived memories.
 * Each derived memory has a deterministic Qdrant point ID based on:
 *   sourceLearningEventId + memoryKind + schemaVersion
 *
 * This guarantees idempotency: retrying the same event upserts the same Qdrant point,
 * never duplicates it.
 *
 * Rules:
 * - Facts may be stored immediately.
 * - Patterns, habits, behavioral conclusions, emotional conclusions, or planning rules
 *   must NOT be inferred from a single event.
 * - task_rescheduled is intentionally excluded until a context/noise-collapse policy exists.
 *
 * Future Memory Integrity Gate phase: evaluate cross-event UI retries, double-clicks,
 * reschedule noise and contradictions before using events as pattern evidence.
 */

import { createHash } from 'crypto';

// ─── Approved memory kinds ────────────────────────────────────────────────────

export type ApprovedLearningMemoryKind =
  | 'task_intent'
  | 'task_completion'
  | 'actual_duration'
  | 'planned_vs_actual_duration';

export const LEARNING_MEMORY_SCHEMA_VERSION = 1 as const;

// ─── Output type ──────────────────────────────────────────────────────────────

export interface DerivedLearningMemory {
  /** Deterministic Qdrant point UUID — same input always produces the same ID */
  pointId: string;
  memoryKind: ApprovedLearningMemoryKind;
  schemaVersion: typeof LEARNING_MEMORY_SCHEMA_VERSION;
  sourceLearningEventId: string;
  /** Factual Hebrew memory text to embed */
  content: string;
  /** Full metadata payload for the Qdrant point */
  metadata: Record<string, unknown>;
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface LearningEventInput {
  id: string;
  userId: string;
  eventType: string;
  taskTitleSnapshot: string | null;
  taskId?: string | null;
  dateIso?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ─── Deterministic ID ────────────────────────────────────────────────────────

/**
 * Derives a stable, Qdrant-compatible UUID from the combination of
 * sourceLearningEventId + memoryKind + schemaVersion.
 *
 * The first 32 hex characters of a SHA-256 hash are formatted as a UUID.
 * Different memoryKinds from the same source event produce different IDs.
 * Retrying the same (source, kind, version) always produces the same ID → upsert-safe.
 */
export function deriveDeterministicPointId(
  sourceLearningEventId: string,
  memoryKind: ApprovedLearningMemoryKind,
  schemaVersion: number
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

// ─── Duration validation helper ──────────────────────────────────────────────

function isValidPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && isFinite(n) && n > 0;
}

// ─── Derivation engine ───────────────────────────────────────────────────────

/**
 * Derives zero or more factual memories from a single learning event.
 *
 * Derivation rules:
 *
 * task_created → 'task_intent' (1 memory)
 * task_completed → 'task_completion' (1 memory)
 * task_execution_completed (confirmed duration) → 'actual_duration' + optionally
 *   'planned_vs_actual_duration' (1–2 memories)
 *
 * Returns an empty array when no derivation is applicable (rejected source,
 * missing title, missing duration, etc.).
 */
export function deriveFactualMemoriesFromLearningEvent(
  event: LearningEventInput
): DerivedLearningMemory[] {
  const title = event.taskTitleSnapshot?.trim();
  if (!title) return [];

  const v = LEARNING_MEMORY_SCHEMA_VERSION;
  const sourceId = event.id;

  const baseMetadata: Record<string, unknown> = {
    source:               'learning_event',
    type:                 event.eventType,
    sourceLearningEventId: sourceId,
    schemaVersion:        v,
    integrityStatus:      'accepted_fact',
    taskId:               event.taskId    ?? undefined,
    dateIso:              event.dateIso   ?? undefined,
    status:               'active',
  };

  // ── task_created → task_intent ──────────────────────────────────────────────
  if (event.eventType === 'task_created') {
    const pointId = deriveDeterministicPointId(sourceId, 'task_intent', v);
    return [{
      pointId,
      memoryKind: 'task_intent',
      schemaVersion: v,
      sourceLearningEventId: sourceId,
      content: `המשתמש יצר משימה חדשה: ${title}.`,
      metadata: {
        ...baseMetadata,
        memoryKind:  'task_intent',
        importance:  'medium',
      },
    }];
  }

  // ── task_completed → task_completion ────────────────────────────────────────
  if (event.eventType === 'task_completed') {
    const pointId = deriveDeterministicPointId(sourceId, 'task_completion', v);
    return [{
      pointId,
      memoryKind: 'task_completion',
      schemaVersion: v,
      sourceLearningEventId: sourceId,
      content: `המשתמש השלים את המשימה: ${title}.`,
      metadata: {
        ...baseMetadata,
        memoryKind:  'task_completion',
        importance:  'high',
      },
    }];
  }

  // ── task_execution_completed → actual_duration + planned_vs_actual_duration ─
  if (event.eventType === 'task_execution_completed') {
    const meta = event.metadata ?? {};
    const startSource = typeof meta.actualStartSource === 'string'
      ? meta.actualStartSource
      : 'unknown';

    const isTimerConfirmed  = startSource === 'execution_start';
    const isUserReported    = startSource === 'user_reported';
    const isConfirmedSource = isTimerConfirmed || isUserReported;

    const actualMins   = meta.actualDurationMinutes;
    const plannedMins  = meta.plannedDurationMinutes;

    if (!isConfirmedSource || !isValidPositiveFinite(actualMins)) {
      // planned_fallback / expired / user_reported_no_duration / invalid → no duration memory
      return [];
    }

    const evidenceFields: Record<string, unknown> = isTimerConfirmed
      ? { evidenceType: 'timer_confirmed',        durationConfidence: 'confirmed' }
      : { evidenceType: 'user_reported_duration',  durationConfidence: 'confirmed' };

    const durationText = isTimerConfirmed
      ? `המשתמש ביצע את המשימה: ${title}. משך הביצוע בפועל שאושר באמצעות טיימר: ${actualMins} דקות.`
      : `המשתמש ביצע את המשימה: ${title}. משך הביצוע בפועל שדווח ואושר על ידי המשתמש: ${actualMins} דקות.`;

    const memories: DerivedLearningMemory[] = [];

    // A — actual_duration
    memories.push({
      pointId: deriveDeterministicPointId(sourceId, 'actual_duration', v),
      memoryKind: 'actual_duration',
      schemaVersion: v,
      sourceLearningEventId: sourceId,
      content: durationText,
      metadata: {
        ...baseMetadata,
        ...evidenceFields,
        memoryKind:            'actual_duration',
        importance:            'medium',
        actualDurationMinutes: actualMins,
        plannedDurationMinutes: isValidPositiveFinite(plannedMins) ? plannedMins : undefined,
      },
    });

    // B — planned_vs_actual_duration (only when planned is also valid)
    if (isValidPositiveFinite(plannedMins)) {
      memories.push({
        pointId: deriveDeterministicPointId(sourceId, 'planned_vs_actual_duration', v),
        memoryKind: 'planned_vs_actual_duration',
        schemaVersion: v,
        sourceLearningEventId: sourceId,
        content: `המשימה ${title} תוכננה למשך ${plannedMins} דקות ובוצעה בפועל במשך ${actualMins} דקות, לפי זמן שאושר.`,
        metadata: {
          ...baseMetadata,
          ...evidenceFields,
          memoryKind:            'planned_vs_actual_duration',
          importance:            'medium',
          plannedDurationMinutes: plannedMins,
          actualDurationMinutes:  actualMins,
          durationDeltaMinutes:
            isValidPositiveFinite(meta.durationDeltaMinutes)
              ? meta.durationDeltaMinutes
              : (actualMins as number) - (plannedMins as number),
        },
      });
    }

    return memories;
  }

  return [];
}
