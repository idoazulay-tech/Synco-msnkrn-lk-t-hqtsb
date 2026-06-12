/**
 * Synco Reschedule Burst Collapse
 *
 * Collapses sequences of nearby task_rescheduled LearningEvents into single
 * SyncoMemory signals with memoryKind 'task_reschedule_burst'.
 *
 * Design constraints:
 * - Pure function — no DB calls, fully testable in isolation.
 * - A burst means "user adjusted this task multiple times in a short window."
 *   It does NOT mean failure, avoidance, or procrastination.
 * - Confidence is 0.40 (moderate/weak, system_derived) — not verified.
 * - Events for different tasks are NEVER collapsed together.
 * - Events far apart in time (> window) become separate bursts.
 * - If taskId is missing, falls back to taskTitleSnapshot → 'unknown'.
 */

import type { SyncoMemory } from './syncoThinkingLayer.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Default collapse window — reschedules within this window → one burst */
export const DEFAULT_BURST_WINDOW_MINUTES = 10;

/**
 * Burst confidence is intentionally moderate/weak.
 * A burst signals repeated adjustment, not confirmed failure.
 */
const BURST_CONFIDENCE = 0.40;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of a raw task_rescheduled LearningEvent row from DB */
export interface RawRescheduledEvent {
  id: string;
  userId: string;
  taskId: string | null;
  eventType: string;
  source: string | null;
  occurredAt: Date;
  taskTitleSnapshot: string | null;
  fromStartTime?: Date | null;
  toStartTime?: Date | null;
  metadata: unknown;
}

export interface BurstCollapseStats {
  rawRescheduleEventsCount: number;
  collapsedRescheduleBurstsCount: number;
  rescheduleCollapseWindowMinutes: number;
}

export interface BurstCollapseResult {
  memories: SyncoMemory[];
  stats: BurstCollapseStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stable group key: same user + same task.
 * taskId preferred; falls back to title or 'unknown'.
 */
function groupKey(event: RawRescheduledEvent): string {
  const taskKey = event.taskId ?? event.taskTitleSnapshot ?? 'unknown';
  return `${event.userId}::${taskKey}`;
}

/** Safely extract ISO time strings from a single event (DB fields + metadata fallback) */
function extractTimes(event: RawRescheduledEvent): { from?: string; to?: string } {
  let from: string | undefined;
  let to: string | undefined;

  if (event.fromStartTime instanceof Date) {
    from = event.fromStartTime.toISOString();
  } else if (
    event.metadata !== null &&
    typeof event.metadata === 'object' &&
    'fromStartTime' in (event.metadata as object)
  ) {
    const raw = (event.metadata as Record<string, unknown>).fromStartTime;
    if (typeof raw === 'string') from = raw;
    else if (raw instanceof Date) from = raw.toISOString();
  }

  if (event.toStartTime instanceof Date) {
    to = event.toStartTime.toISOString();
  } else if (
    event.metadata !== null &&
    typeof event.metadata === 'object' &&
    'toStartTime' in (event.metadata as object)
  ) {
    const raw = (event.metadata as Record<string, unknown>).toStartTime;
    if (typeof raw === 'string') to = raw;
    else if (raw instanceof Date) to = raw.toISOString();
  }

  return { from, to };
}

/** Build one SyncoMemory from a burst group (1 or more events) */
function buildBurstMemory(events: RawRescheduledEvent[]): SyncoMemory {
  const first = events[0];
  const last  = events[events.length - 1];

  const firstAt          = first.occurredAt;
  const lastAt           = last.occurredAt;
  const durationMs       = lastAt.getTime() - firstAt.getTime();
  const burstDurationMinutes = Math.round(durationMs / 60_000 * 10) / 10;

  const fromTimes: string[] = [];
  const toTimes: string[]   = [];
  for (const e of events) {
    const { from, to } = extractTimes(e);
    if (from) fromTimes.push(from);
    if (to)   toTimes.push(to);
  }

  return {
    id:         `burst-${first.id}`,
    userId:     first.userId,
    memoryKind: 'task_reschedule_burst',
    entityType: 'task',
    entityId:   first.taskId ?? undefined,
    entityName: first.taskTitleSnapshot ?? undefined,
    occurredAt: firstAt.toISOString(),
    source:     'system_derived',
    confidence: BURST_CONFIDENCE,
    metadata: {
      originalEventCount:    events.length,
      firstRescheduledAt:    firstAt.toISOString(),
      lastRescheduledAt:     lastAt.toISOString(),
      burstDurationMinutes,
      fromTimes:             fromTimes.length > 0 ? fromTimes : undefined,
      toTimes:               toTimes.length  > 0 ? toTimes  : undefined,
      isBurst:               true,
    },
  };
}

// ─── Main pure function ───────────────────────────────────────────────────────

/**
 * Collapses raw task_rescheduled events into burst SyncoMemory signals.
 *
 * Algorithm:
 * 1. Sort events by (groupKey, occurredAt asc).
 * 2. Sweep linearly: if next event is same task AND within windowMinutes
 *    of the previous event → extend current burst; otherwise → close burst.
 * 3. Each closed burst → one SyncoMemory with memoryKind 'task_reschedule_burst'.
 *
 * @param events        task_rescheduled events (any order accepted)
 * @param windowMinutes Max gap (in minutes) to merge into one burst. Default: 10.
 */
export function collapseRescheduleBursts(
  events: RawRescheduledEvent[],
  windowMinutes: number = DEFAULT_BURST_WINDOW_MINUTES,
): BurstCollapseResult {
  const stats: BurstCollapseStats = {
    rawRescheduleEventsCount:      events.length,
    collapsedRescheduleBurstsCount: 0,
    rescheduleCollapseWindowMinutes: windowMinutes,
  };

  if (events.length === 0) {
    return { memories: [], stats };
  }

  const windowMs = windowMinutes * 60_000;

  // Sort by group key then by time ascending
  const sorted = [...events].sort((a, b) => {
    const ka = groupKey(a);
    const kb = groupKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.occurredAt.getTime() - b.occurredAt.getTime();
  });

  const bursts: SyncoMemory[] = [];
  let currentGroup: RawRescheduledEvent[] = [sorted[0]];
  let currentKey = groupKey(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const key   = groupKey(event);
    const prev  = currentGroup[currentGroup.length - 1];
    const gap   = event.occurredAt.getTime() - prev.occurredAt.getTime();

    const sameTask     = key === currentKey;
    const withinWindow = sameTask && gap <= windowMs;

    if (withinWindow) {
      currentGroup.push(event);
    } else {
      bursts.push(buildBurstMemory(currentGroup));
      currentGroup = [event];
      currentKey   = key;
    }
  }
  bursts.push(buildBurstMemory(currentGroup));

  stats.collapsedRescheduleBurstsCount = bursts.length;
  return { memories: bursts, stats };
}
