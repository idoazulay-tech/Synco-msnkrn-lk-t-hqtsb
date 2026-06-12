/**
 * Synco Pattern Decay + Evidence Count Guard
 *
 * Phase 6: Applies time-based exponential decay to pattern confidence.
 * Phase 7: Adds evidence count guard — well-evidenced patterns decay slightly
 *          slower, but guard cannot increase confidence or prevent trend penalty.
 *
 * Confidence flow (per pattern):
 *   rawConfidence
 *     → × decayFactor        (exponential time decay)
 *     → × evidenceGuardFactor (small slowdown for high evidenceCount, never > raw)
 *     → [trend override applied separately in recentTrendAnalyzer.ts]
 *     → final confidence
 *
 * Design constraints:
 * - Pure functions — no DB calls, no side effects, fully testable.
 * - Decay is calculation-time only. DB data is never mutated.
 * - Stale patterns are retained for transparency — not fed to hypothesis creation.
 * - Confidence always clamped to [0, 1].
 * - Evidence guard never increases confidence above rawConfidence × decayFactor × maxSlowdown.
 * - Evidence guard cannot prevent the trend contradiction penalty (applied later).
 *
 * Thresholds (post-decay + guard, before trend):
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

/** Evidence count at which the guard starts applying */
export const EVIDENCE_GUARD_MIN_COUNT = 5;

/** Maximum slowdown the guard can apply (15%) — never increases confidence */
export const EVIDENCE_GUARD_MAX_SLOWDOWN = 0.15;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecayOptions {
  /** Days until confidence drops by factor of e^(-1) ≈ 0.368. Default: 30. */
  halfLifeDays?: number;
  /** Reference time for age calculation. Default: new Date(). */
  now?: Date;
}

export interface PatternDecayDiagnostics {
  rawConfidence: number;
  confidenceAfterDecay: number;       // after time decay only
  confidenceBeforeGuard: number;      // = confidenceAfterDecay (for readability)
  confidenceAfterGuard: number;       // after evidence guard (this is .confidence before trend)
  evidenceCountGuardApplied: boolean;
  evidenceGuardFactor: number;        // 1.0 if no guard applied
  decayedConfidence: number;          // alias for confidenceAfterDecay (backwards compat)
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
 * calculateEvidenceGuardFactor — returns how much to slow decay for this pattern.
 *
 * Logarithmic scaling: more evidence = slightly slower decay.
 * Factor is always >= 1 (never reduces confidence below decayed value).
 * Factor is always <= 1 + EVIDENCE_GUARD_MAX_SLOWDOWN.
 *
 *   evidenceCount <  5   → factor = 1.00 (no guard)
 *   evidenceCount =  5   → factor ≈ 1.00 (guard starts)
 *   evidenceCount = 50   → factor ≈ 1.15 (max slowdown)
 *   evidenceCount = 100  → factor = 1.15 (capped)
 */
export function calculateEvidenceGuardFactor(evidenceCount: number): number {
  if (evidenceCount < EVIDENCE_GUARD_MIN_COUNT) return 1;
  const scale = Math.min(
    1,
    Math.log(evidenceCount / EVIDENCE_GUARD_MIN_COUNT + 1) / Math.log(11),
  );
  return 1 + EVIDENCE_GUARD_MAX_SLOWDOWN * scale;
}

/**
 * applyPatternDecay — applies decay + evidence guard to one pattern.
 * Returns an updated copy; original is never mutated.
 * Adds rawConfidence and decayDiagnostics to the result.
 */
export function applyPatternDecay(
  pattern: SyncoPattern,
  now: Date = new Date(),
  options: DecayOptions = {},
): SyncoPattern {
  const halfLifeDays    = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const lastSeenMs      = new Date(pattern.lastSeen).getTime();
  const daysSinceLastSeen = Math.max(0, (now.getTime() - lastSeenMs) / 86_400_000);
  const decayFactor     = calculateDecayFactor(daysSinceLastSeen, halfLifeDays);
  const rawConfidence   = pattern.rawConfidence ?? pattern.confidence;

  // Step 1: apply time decay
  const confidenceAfterDecay = Math.max(0, Math.min(1, rawConfidence * decayFactor));

  // Step 2: apply evidence count guard (slows decay slightly for well-evidenced patterns)
  const guardFactor = calculateEvidenceGuardFactor(pattern.evidenceCount);
  const guardApplied = guardFactor > 1;
  const confidenceAfterGuard = guardApplied
    ? Math.max(0, Math.min(rawConfidence, confidenceAfterDecay * guardFactor))
    : confidenceAfterDecay;

  const statusAfter: 'active' | 'candidate' | 'stale' =
    confidenceAfterGuard >= DECAY_THRESHOLD_ACTIVE    ? 'active'    :
    confidenceAfterGuard >= DECAY_THRESHOLD_CANDIDATE ? 'candidate' : 'stale';

  const decayDiagnostics: PatternDecayDiagnostics = {
    rawConfidence,
    confidenceAfterDecay,
    confidenceBeforeGuard: confidenceAfterDecay,
    confidenceAfterGuard,
    evidenceCountGuardApplied: guardApplied,
    evidenceGuardFactor: Math.round(guardFactor * 10_000) / 10_000,
    decayedConfidence: confidenceAfterDecay,          // backwards compat alias
    daysSinceLastSeen: Math.round(daysSinceLastSeen * 10) / 10,
    decayFactor:       Math.round(decayFactor * 10_000) / 10_000,
    halfLifeDays,
    statusBefore: pattern.status,
    statusAfter,
  };

  return {
    ...pattern,
    confidence:    confidenceAfterGuard,
    status:        statusAfter,
    rawConfidence,
    decayDiagnostics,
  };
}

/**
 * applyDecayToPatterns — applies decay + guard to all patterns.
 * Returns a new array; input is not mutated.
 */
export function applyDecayToPatterns(
  patterns: SyncoPattern[],
  now: Date = new Date(),
  options: DecayOptions = {},
): SyncoPattern[] {
  return patterns.map(p => applyPatternDecay(p, now, options));
}
