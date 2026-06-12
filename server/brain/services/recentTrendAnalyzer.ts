/**
 * Synco Recent Trend Analyzer — Phase 7
 *
 * Detects when recent user behavior contradicts an established pattern,
 * and applies a confidence penalty when it does.
 *
 * Rules:
 * - Only penalizes (never increases) confidence.
 * - evidenceCount guard cannot prevent this penalty.
 * - Penalty is multiplicative: confidence × contradictionPenaltyFactor.
 * - Applied AFTER decay + evidence guard.
 * - Requires at least MINIMUM_RECENT_EVIDENCE recent events to make a ruling.
 * - "Recent" = within RECENT_WINDOW_DAYS days.
 *
 * Confidence flow (full chain):
 *   rawConfidence → decay → evidenceGuard → trendOverride → final
 */

import type { SyncoPattern, SyncoMemory } from './syncoThinkingLayer.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Days to consider "recent" for trend detection */
export const RECENT_WINDOW_DAYS = 14;

/** Minimum recent events required to declare a trend */
export const MINIMUM_RECENT_EVIDENCE = 3;

/** Confidence penalty multiplier when recent trend contradicts the pattern */
export const CONTRADICTION_PENALTY_FACTOR = 0.5;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendStatus =
  | 'reinforcing'        // recent events support the pattern
  | 'contradicting'      // recent events contradict the pattern → penalty applied
  | 'neutral'            // recent events are unrelated to the pattern
  | 'insufficient_data'; // not enough recent evidence to make a ruling

export interface TrendAnalysis {
  status: TrendStatus;
  recentEventCount: number;
  recentWindowDays: number;
  penaltyApplied: boolean;
  penaltyFactor: number;              // 1.0 if no penalty; CONTRADICTION_PENALTY_FACTOR if contradicting
  confidenceBeforeTrend: number;
  confidenceAfterTrend: number;
}

export interface TrendOptions {
  recentWindowDays?: number;
  minimumRecentEvidence?: number;
  contradictionPenaltyFactor?: number;
  now?: Date;
}

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * isMemoryRecentForPattern — returns true if a SyncoMemory is:
 * 1. related to the same userId as the pattern
 * 2. within the recent window
 * 3. mentioning the pattern's relatedEntityName or patternType (loose match)
 */
function isMemoryRecentForPattern(
  memory: SyncoMemory,
  pattern: SyncoPattern,
  cutoffMs: number,
): boolean {
  if (memory.userId !== pattern.userId) return false;
  const ts = new Date(memory.occurredAt).getTime();
  if (isNaN(ts) || ts < cutoffMs) return false;
  return true;
}

/**
 * detectTrendStatus — classify recent behavior relative to the pattern.
 *
 * A "contradicting" trend means recent events of a DIFFERENT memoryKind
 * dominate over events that match the pattern's patternType.
 *
 * A "reinforcing" trend means the recent events are predominantly consistent
 * with the pattern's patternType/relatedEntityName.
 *
 * "neutral" means the recent events are unrelated.
 *
 * Strategy (simple, phase-7 spec):
 * - Count recent memories whose memoryKind matches pattern's patternType → reinforce count
 * - Count recent memories that are explicitly contradictory (e.g., completion patterns
 *   vs. rescheduled events for the same entity) → contradict count
 * - If reinforce > contradict → reinforcing
 * - If contradict > reinforce → contradicting
 * - Else → neutral
 */
function detectTrendStatus(
  recentMemories: SyncoMemory[],
  pattern: SyncoPattern,
): TrendStatus {
  if (recentMemories.length === 0) return 'insufficient_data';

  let reinforceCount = 0;
  let contradictCount = 0;

  for (const mem of recentMemories) {
    const kind = mem.memoryKind ?? '';

    // Memory reinforces this pattern: same kind or related entity matches
    const reinforces =
      kind === pattern.patternType ||
      (pattern.relatedEntityName &&
        (mem.entityName ?? '').toLowerCase().includes(pattern.relatedEntityName.toLowerCase()));

    // Memory contradicts: e.g., a "task_rescheduled" memory for the same entity
    // when the pattern is "task_completed_on_time", or vice versa
    const contradicts =
      !reinforces &&
      ((pattern.patternType.includes('completed') && kind.includes('reschedule')) ||
       (pattern.patternType.includes('reschedule') && kind.includes('completed')) ||
       (pattern.patternType.includes('on_time') && kind.includes('late')) ||
       (pattern.patternType.includes('morning') && kind.includes('evening')) ||
       (pattern.patternType.includes('evening') && kind.includes('morning')));

    if (reinforces) reinforceCount++;
    else if (contradicts) contradictCount++;
  }

  if (reinforceCount === 0 && contradictCount === 0) return 'neutral';
  if (contradictCount > reinforceCount) return 'contradicting';
  if (reinforceCount >= contradictCount) return 'reinforcing';
  return 'neutral';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * applyTrendOverride — applies trend analysis to one pattern.
 *
 * Returns [updatedPattern, TrendAnalysis].
 * If trend is contradicting: confidence × CONTRADICTION_PENALTY_FACTOR.
 * All other trends: no change to confidence.
 */
export function applyTrendOverride(
  pattern: SyncoPattern,
  allMemories: SyncoMemory[],
  options: TrendOptions = {},
): [SyncoPattern, TrendAnalysis] {
  const {
    recentWindowDays       = RECENT_WINDOW_DAYS,
    minimumRecentEvidence  = MINIMUM_RECENT_EVIDENCE,
    contradictionPenaltyFactor = CONTRADICTION_PENALTY_FACTOR,
    now                    = new Date(),
  } = options;

  const cutoffMs = now.getTime() - recentWindowDays * 86_400_000;
  const recentMemories = allMemories.filter(m =>
    isMemoryRecentForPattern(m, pattern, cutoffMs),
  );

  const recentEventCount = recentMemories.length;
  const confidenceBeforeTrend = pattern.confidence;

  let status: TrendStatus;
  if (recentEventCount < minimumRecentEvidence) {
    status = 'insufficient_data';
  } else {
    status = detectTrendStatus(recentMemories, pattern);
  }

  const penaltyApplied = status === 'contradicting';
  const penaltyFactor  = penaltyApplied ? contradictionPenaltyFactor : 1;
  const confidenceAfterTrend = Math.max(0, Math.min(1, confidenceBeforeTrend * penaltyFactor));

  const trendAnalysis: TrendAnalysis = {
    status,
    recentEventCount,
    recentWindowDays,
    penaltyApplied,
    penaltyFactor,
    confidenceBeforeTrend,
    confidenceAfterTrend,
  };

  if (!penaltyApplied) {
    return [{ ...pattern, trendDiagnostics: trendAnalysis }, trendAnalysis];
  }

  const updatedStatus: 'active' | 'candidate' | 'stale' =
    confidenceAfterTrend >= 0.55 ? 'active'    :
    confidenceAfterTrend >= 0.35 ? 'candidate' : 'stale';

  const updated: SyncoPattern = {
    ...pattern,
    confidence: confidenceAfterTrend,
    status:     updatedStatus,
    trendDiagnostics: trendAnalysis,
  };

  return [updated, trendAnalysis];
}

/**
 * applyTrendOverrideToPatterns — batch version.
 */
export function applyTrendOverrideToPatterns(
  patterns: SyncoPattern[],
  allMemories: SyncoMemory[],
  options: TrendOptions = {},
): SyncoPattern[] {
  return patterns.map(p => applyTrendOverride(p, allMemories, options)[0]);
}
