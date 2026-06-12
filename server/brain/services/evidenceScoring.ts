/**
 * Synco Evidence Scoring
 *
 * Every memory or signal has a source quality.
 * This module scores, classifies, and compares evidence so the Pattern Engine
 * and Causality Engine never treat a user self-report as a verified fact.
 *
 * Source quality chain (highest → lowest):
 *   timer_confirmed > observed > user_reported > ai_inferred > prediction > experiment_result
 *
 * Design principles:
 * - Pure functions, no I/O.
 * - Contradiction detection never deletes data — it flags.
 * - Confidence is always 0–1, clamped.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemorySource =
  | "user_reported"
  | "observed"
  | "timer_confirmed"
  | "system_derived"
  | "ai_inferred"
  | "prediction"
  | "experiment_result";

export type EvidenceStrength = "weak" | "moderate" | "strong" | "verified";

export interface EvidenceScoringInput {
  source: MemorySource;
  confidence: number;         // 0–1 raw confidence from creator
  repetitionCount?: number;   // how many times this signal was observed
  recencyDays?: number;       // days since most recent observation (0 = today)
  confirmedByAction?: boolean;
  contradictedByCount?: number;
}

export interface EvidenceScore {
  raw: number;                // 0–1, final computed score
  strength: EvidenceStrength;
  adjustments: string[];      // human-readable explanation of each adjustment
}

export interface ContradictionFlag {
  memoryIdA: string;
  memoryIdB: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

// ─── Source base scores ───────────────────────────────────────────────────────

const SOURCE_BASE: Record<MemorySource, number> = {
  timer_confirmed:   0.95,
  observed:          0.80,
  user_reported:     0.55,
  system_derived:    0.65,
  ai_inferred:       0.45,
  experiment_result: 0.70,
  prediction:        0.25,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Evidence scoring ─────────────────────────────────────────────────────────

export function calculateEvidenceScore(input: EvidenceScoringInput): EvidenceScore {
  const adjustments: string[] = [];
  let score = SOURCE_BASE[input.source] ?? 0.3;
  adjustments.push(`source=${input.source} base=${score.toFixed(2)}`);

  // Raw confidence shifts score toward it slightly
  const confDelta = (input.confidence - 0.5) * 0.2;
  score += confDelta;
  adjustments.push(`confidence_delta=${confDelta.toFixed(3)}`);

  // Repetition bonus (diminishing returns)
  if (input.repetitionCount && input.repetitionCount > 1) {
    const bonus = Math.min(0.15, (input.repetitionCount - 1) * 0.03);
    score += bonus;
    adjustments.push(`repetition_bonus=${bonus.toFixed(3)} (n=${input.repetitionCount})`);
  }

  // Recency penalty: degrades over 90 days, max -0.2
  if (input.recencyDays !== undefined && input.recencyDays > 0) {
    const penalty = Math.min(0.2, (input.recencyDays / 90) * 0.2);
    score -= penalty;
    adjustments.push(`recency_penalty=-${penalty.toFixed(3)} (${input.recencyDays}d ago)`);
  }

  // Action confirmation bonus
  if (input.confirmedByAction) {
    score += 0.1;
    adjustments.push("confirmed_by_action=+0.10");
  }

  // Contradiction penalty
  if (input.contradictedByCount && input.contradictedByCount > 0) {
    const penalty = Math.min(0.25, input.contradictedByCount * 0.08);
    score -= penalty;
    adjustments.push(`contradiction_penalty=-${penalty.toFixed(3)} (n=${input.contradictedByCount})`);
  }

  const raw = clamp01(score);
  return { raw, strength: classifyEvidenceStrength(raw), adjustments };
}

// ─── Strength classification ──────────────────────────────────────────────────

export function classifyEvidenceStrength(score: number): EvidenceStrength {
  if (score >= 0.85) return "verified";
  if (score >= 0.65) return "strong";
  if (score >= 0.45) return "moderate";
  return "weak";
}

// ─── Source comparison ────────────────────────────────────────────────────────

/**
 * Returns positive if sourceA is more reliable than sourceB,
 * negative if less reliable, 0 if equal.
 */
export function compareEvidenceSources(
  sourceA: MemorySource,
  sourceB: MemorySource
): number {
  return (SOURCE_BASE[sourceA] ?? 0) - (SOURCE_BASE[sourceB] ?? 0);
}

// ─── Contradiction detection ──────────────────────────────────────────────────

export interface SimpleMemory {
  id: string;
  userId: string;
  memoryKind: string;
  entityName?: string;
  source: MemorySource;
  confidence: number;
  boolValue?: boolean;   // for yes/no memories
  numericValue?: number; // for measurable memories (e.g. "arrives late" vs "90% on time")
}

/**
 * Detects contradictions between pairs of memories of the same kind/entity.
 * Does NOT delete — only flags.
 */
export function detectContradictions(memories: SimpleMemory[]): ContradictionFlag[] {
  const flags: ContradictionFlag[] = [];

  // Group by userId + memoryKind + entityName
  const groups = new Map<string, SimpleMemory[]>();
  for (const m of memories) {
    const key = `${m.userId}|${m.memoryKind}|${m.entityName ?? ""}`;
    const g = groups.get(key) ?? [];
    g.push(m);
    groups.set(key, g);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Bool contradiction
        if (
          a.boolValue !== undefined &&
          b.boolValue !== undefined &&
          a.boolValue !== b.boolValue
        ) {
          const higherSource = compareEvidenceSources(a.source, b.source);
          const severity =
            higherSource === 0
              ? "high"
              : Math.abs(higherSource) > 0.2
              ? "medium"
              : "low";

          flags.push({
            memoryIdA: a.id,
            memoryIdB: b.id,
            reason: `Memory kind "${a.memoryKind}" has conflicting boolean values: ${a.source}=${a.boolValue} vs ${b.source}=${b.boolValue}`,
            severity,
          });
        }

        // Numeric contradiction — values differ by >50% of the larger
        if (
          a.numericValue !== undefined &&
          b.numericValue !== undefined
        ) {
          const max = Math.max(Math.abs(a.numericValue), Math.abs(b.numericValue));
          const diff = Math.abs(a.numericValue - b.numericValue);
          if (max > 0 && diff / max > 0.5) {
            flags.push({
              memoryIdA: a.id,
              memoryIdB: b.id,
              reason: `Memory kind "${a.memoryKind}" has conflicting numeric values: ${a.numericValue} vs ${b.numericValue} (${Math.round((diff / max) * 100)}% diff)`,
              severity: "medium",
            });
          }
        }
      }
    }
  }

  return flags;
}

/**
 * When a user self-reports something that contradicts observed behavior,
 * return the observed-behavior memory as the more reliable signal.
 * Returns null if no contradiction or observed wins clearly.
 */
export function resolveUserVsObserved(
  userReported: SimpleMemory,
  observed: SimpleMemory
): { winner: SimpleMemory; loser: SimpleMemory; explanation: string } | null {
  if (userReported.memoryKind !== observed.memoryKind) return null;

  const userScore = calculateEvidenceScore({
    source: userReported.source,
    confidence: userReported.confidence,
  });
  const observedScore = calculateEvidenceScore({
    source: observed.source,
    confidence: observed.confidence,
  });

  if (observedScore.raw > userScore.raw + 0.1) {
    return {
      winner: observed,
      loser: userReported,
      explanation: `Observed behavior (score ${observedScore.raw.toFixed(2)}) overrides user self-report (score ${userScore.raw.toFixed(2)}) for "${userReported.memoryKind}". User self-perception stored as weak_signal only.`,
    };
  }

  return null;
}
