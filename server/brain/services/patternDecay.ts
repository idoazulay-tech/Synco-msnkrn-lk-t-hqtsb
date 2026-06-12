/**
 * Synco Pattern Decay
 *
 * Applies time-based exponential decay to pattern confidence.
 * Older behavioral evidence should have less influence than recent behavior.
 *
 * Formula:
 *   decayFactor       = e^(-daysSinceLastSeen / halfLifeDays)
 *   decayedConfidence = rawConfidence * decayFactor
 *
 * Design constraints:
 * - Pure functions — no DB calls, no side effects, fully testable.
 * - Decay is calculation-time only. DB data is never mutated.
 * - Stale patterns are retained in output for transparency — they just don't
 *   feed into hypothesis creation or strong predictions.
 * - Confidence always clamped to [0, 1].
 *
 * Thresholds (post-decay):
 *   active    confidence >= 0.55
 *   candidate confidence >= 0.35
 *   stale     confidence <  0.35
 */

import type { SyncoPattern } from './syncoThinkingLayer.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default time constant for exponential decay (days) */
export const DEFAULT_HALF_LIFE_DAYS = 30;

/** Post-decay confidence threshold for "active" status */
export const DECAY_THRESHOLD_ACTIVE = 0.55;

/** Post-decay confidence threshold for "candidate" status; below → stale */
export const DECAY_THRESHOLD_CANDIDATE = 0.35;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecayOptions {
  /** Days until confidence drops by factor of e^(-1) ≈ 0.368. Default: 30. */
  halfLifeDays?: number;
  /** Reference time for age calculation. Default: new Date(). */
  now?: Date;
}

export interface PatternDecayDiagnostics {
  rawConfidence: number;
  decayedConfidence: number;
  daysSinceLastSeen: number;
  decayFactor: number;
  halfLifeDays: number;
  statusBefore: string;
  statusAfter: 'active' | 'candidate' | 'stale';
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * calculateDecayFactor — pure math, no side effects.
 * Returns a value in (0, 1]:
 *   0 days → 1.0 (no decay)
 *   halfLifeDays → ≈ 0.368
 *   3× halfLifeDays → ≈ 0.050
 */
export function calculateDecayFactor(
  daysSinceLastSeen: number,
  halfLifeDays: number,
): number {
  if (daysSinceLastSeen <= 0) return 1;
  if (halfLifeDays <= 0) return 1;
  return Math.exp(-daysSinceLastSeen / halfLifeDays);
}

/**
 * applyPatternDecay — applies decay to one pattern and returns an updated copy.
 * The original pattern object is never mutated.
 * Adds rawConfidence and decayDiagnostics to the returned copy.
 */
export function applyPatternDecay(
  pattern: SyncoPattern,
  now: Date = new Date(),
  options: DecayOptions = {},
): SyncoPattern {
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;

  const lastSeenMs      = new Date(pattern.lastSeen).getTime();
  const daysSinceLastSeen = Math.max(0, (now.getTime() - lastSeenMs) / 86_400_000);
  const decayFactor     = calculateDecayFactor(daysSinceLastSeen, halfLifeDays);
  const rawConfidence   = pattern.rawConfidence ?? pattern.confidence;
  const decayedConfidence = Math.max(0, Math.min(1, rawConfidence * decayFactor));

  const statusAfter: 'active' | 'candidate' | 'stale' =
    decayedConfidence >= DECAY_THRESHOLD_ACTIVE    ? 'active'    :
    decayedConfidence >= DECAY_THRESHOLD_CANDIDATE ? 'candidate' : 'stale';

  const decayDiagnostics: PatternDecayDiagnostics = {
    rawConfidence,
    decayedConfidence,
    daysSinceLastSeen: Math.round(daysSinceLastSeen * 10) / 10,
    decayFactor:       Math.round(decayFactor * 10_000) / 10_000,
    halfLifeDays,
    statusBefore: pattern.status,
    statusAfter,
  };

  return {
    ...pattern,
    confidence:       decayedConfidence,
    status:           statusAfter,
    rawConfidence,
    decayDiagnostics,
  };
}

/**
 * applyDecayToPatterns — applies decay to all patterns in a list.
 * Returns a new array; input is not mutated.
 */
export function applyDecayToPatterns(
  patterns: SyncoPattern[],
  now: Date = new Date(),
  options: DecayOptions = {},
): SyncoPattern[] {
  return patterns.map(p => applyPatternDecay(p, now, options));
}
