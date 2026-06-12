/**
 * Synco Pattern Explainability — Phase 7
 *
 * Generates structured internal diagnostics for each pattern.
 * English only — this is developer/diagnostics output, not user-facing.
 *
 * The explanation summarises the full confidence pipeline in one place,
 * so engineers can audit why a pattern ended up at a given confidence.
 */

import type { SyncoPattern } from './syncoThinkingLayer.js';
import {
  DECAY_THRESHOLD_ACTIVE,
  DECAY_THRESHOLD_CANDIDATE,
  EVIDENCE_GUARD_MIN_COUNT,
} from './patternDecay.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceSignal = 'strong' | 'moderate' | 'weak' | 'stale';

export interface PatternExplanation {
  patternId: string;
  summary: string;                  // one-line human-readable summary
  confidenceSignal: ConfidenceSignal;
  confidencePath: {
    raw: number;
    afterDecay: number | null;
    afterEvidenceGuard: number | null;
    afterTrend: number | null;
    final: number;
  };
  keyFactors: string[];             // ordered list of factors that shaped the result
  warnings: string[];               // non-blocking issues (stale, low evidence, etc.)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSignal(confidence: number): ConfidenceSignal {
  if (confidence >= DECAY_THRESHOLD_ACTIVE)    return 'strong';
  if (confidence >= DECAY_THRESHOLD_CANDIDATE) return 'moderate';
  if (confidence > 0)                          return 'weak';
  return 'stale';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * explainPattern — produces a PatternExplanation for one pattern.
 *
 * Reads optional diagnostic sub-objects (decayDiagnostics, trendDiagnostics)
 * that are attached by earlier pipeline stages.
 */
export function explainPattern(pattern: SyncoPattern): PatternExplanation {
  const raw       = pattern.rawConfidence ?? pattern.confidence;
  const final     = pattern.confidence;
  const decay     = pattern.decayDiagnostics;
  const trend     = pattern.trendDiagnostics;

  const afterDecay        = decay ? round2(decay.confidenceAfterDecay) : null;
  const afterEvidenceGuard = decay ? round2(decay.confidenceAfterGuard) : null;
  const afterTrend        = trend ? round2(trend.confidenceAfterTrend) : null;

  const keyFactors: string[] = [];
  const warnings:   string[] = [];

  // — Raw confidence source
  keyFactors.push(
    `Raw confidence ${round2(raw)} from ${pattern.evidenceCount} evidence event(s)` +
    (pattern.evidenceCount === 1 ? ' (single event — treat as provisional)' : ''),
  );

  // — Decay
  if (decay) {
    const pctLost = Math.round((1 - decay.decayFactor) * 100);
    keyFactors.push(
      `Time decay: −${pctLost}% over ${decay.daysSinceLastSeen}d` +
      ` (halfLife=${decay.halfLifeDays}d, factor=${decay.decayFactor})`,
    );
    if (decay.evidenceCountGuardApplied) {
      const pctRecov = Math.round((decay.evidenceGuardFactor - 1) * 100);
      keyFactors.push(
        `Evidence guard: +${pctRecov}% slowdown applied` +
        ` (evidenceCount=${pattern.evidenceCount} ≥ ${EVIDENCE_GUARD_MIN_COUNT})`,
      );
    }
    if (decay.statusAfter === 'stale') {
      warnings.push(`Pattern became stale after decay (confidence ${round2(decay.confidenceAfterGuard)})`);
    }
  } else {
    warnings.push('No decay diagnostics — pattern may not have gone through decay pipeline');
  }

  // — Trend
  if (trend) {
    if (trend.penaltyApplied) {
      keyFactors.push(
        `Trend contradiction penalty: ×${trend.penaltyFactor}` +
        ` (${trend.recentEventCount} recent events in ${trend.recentWindowDays}d window contradicted pattern)`,
      );
      warnings.push('Recent behavior contradicts this pattern — confidence penalised');
    } else if (trend.status === 'reinforcing') {
      keyFactors.push(`Recent trend reinforces pattern (${trend.recentEventCount} supporting events)`);
    } else if (trend.status === 'insufficient_data') {
      keyFactors.push(`Trend: insufficient recent data (${trend.recentEventCount} events < threshold)`);
    } else {
      keyFactors.push(`Trend: ${trend.status} (no penalty applied)`);
    }
  }

  // — Final status
  keyFactors.push(`Final confidence ${round2(final)} → status: ${pattern.status}`);

  // — General warnings
  if (pattern.evidenceCount < 3) {
    warnings.push(`Low evidence count (${pattern.evidenceCount}) — pattern may be unstable`);
  }
  if (!pattern.relatedEntityName) {
    warnings.push('No relatedEntityName — trend detection is coarser without an entity anchor');
  }

  // — Summary sentence
  const ageDays = decay ? ` (${decay.daysSinceLastSeen}d ago)` : '';
  const summary =
    `Pattern "${pattern.patternName}" [${pattern.patternType}]` +
    `${ageDays}: ${pattern.evidenceCount} evidence(s), ` +
    `confidence ${round2(raw)} → ${round2(final)} (${pattern.status})` +
    (trend?.penaltyApplied ? ' ⚠ trend contradiction' : '');

  return {
    patternId: pattern.patternId,
    summary,
    confidenceSignal: toSignal(final),
    confidencePath: {
      raw:               round2(raw),
      afterDecay,
      afterEvidenceGuard,
      afterTrend,
      final:             round2(final),
    },
    keyFactors,
    warnings,
  };
}

/**
 * explainPatterns — batch version.
 */
export function explainPatterns(patterns: SyncoPattern[]): PatternExplanation[] {
  return patterns.map(explainPattern);
}
