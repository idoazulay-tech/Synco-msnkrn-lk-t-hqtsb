export type EvidenceStrength =
  | "weak"
  | "moderate"
  | "strong"
  | "verified";

export type MemorySource =
  | "user_reported"
  | "observed"
  | "timer_confirmed"
  | "system_derived";

export type SyncoMemory = {
  id: string;
  userId: string;
  memoryKind: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  occurredAt: string;
  source: MemorySource;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export type SyncoPattern = {
  patternId: string;
  userId: string;
  patternType: string;
  patternName: string;
  evidenceCount: number;
  confidence: number;
  evidenceMemoryIds: string[];
  firstSeen: string;
  lastSeen: string;
  relatedEntityName?: string;
  status: "candidate" | "active" | "stale";
  // Phase 6: populated after decay is applied
  rawConfidence?: number;
  decayDiagnostics?: {
    rawConfidence: number;
    decayedConfidence: number;
    daysSinceLastSeen: number;
    decayFactor: number;
    halfLifeDays: number;
    statusBefore: string;
    statusAfter: "active" | "candidate" | "stale";
  };
};

export type CausalHypothesis = {
  hypothesisId: string;
  userId: string;
  hypothesisType: string;
  causeSignal: string;
  effectPatternId: string;
  evidenceCount: number;
  confidence: number;
  strength: EvidenceStrength;
  status: "hypothesis_only" | "needs_more_evidence" | "ready_for_experiment";
};

export type PredictionRisk = {
  predictionId: string;
  userId: string;
  riskType: string;
  probability: number;
  basedOnHypothesisIds: string[];
  explanation: string;
  confidence: EvidenceStrength;
};

export type PersonalExperiment = {
  experimentId: string;
  userId: string;
  title: string;
  hypothesisId: string;
  durationDays: number;
  successMetric: string;
  status: "proposed";
};

export type LifeRule = {
  ruleId: string;
  userId: string;
  ruleType: string;
  title: string;
  priority: "low" | "medium" | "high" | "non_negotiable";
  active: boolean;
};

export type DecisionCandidate = {
  decisionId: string;
  userId: string;
  title: string;
  metadata?: Record<string, unknown>;
};

export type LifeRuleEvaluation = {
  allowed: boolean;
  blockedByRuleIds: string[];
  warnings: string[];
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function evidenceStrength(confidence: number): EvidenceStrength {
  if (confidence >= 0.9) return "verified";
  if (confidence >= 0.75) return "strong";
  if (confidence >= 0.55) return "moderate";
  return "weak";
}

function stableId(parts: Array<string | number | undefined>): string {
  return parts.filter(Boolean).join(":").toLowerCase().replace(/[^a-z0-9:_-]/g, "_");
}

export function detectPatterns(memories: SyncoMemory[]): SyncoPattern[] {
  const groups = new Map<string, SyncoMemory[]>();

  for (const memory of memories) {
    if (memory.confidence < 0.5) continue;

    const key = [
      memory.userId,
      memory.memoryKind,
      memory.entityType ?? "unknown_entity_type",
      memory.entityName ?? "general"
    ].join("|");

    const existing = groups.get(key) ?? [];
    existing.push(memory);
    groups.set(key, existing);
  }

  const patterns: SyncoPattern[] = [];

  for (const [key, items] of groups.entries()) {
    if (items.length < 3) continue;

    const [userId, memoryKind, entityType, entityName] = key.split("|");
    const sorted = [...items].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const avgConfidence =
      sorted.reduce((sum, item) => sum + item.confidence, 0) / sorted.length;

    patterns.push({
      patternId: stableId(["pattern", userId, memoryKind, entityType, entityName]),
      userId,
      patternType: memoryKind,
      patternName: `${memoryKind}_${entityName}`,
      evidenceCount: sorted.length,
      confidence: clamp01(avgConfidence * Math.min(1, sorted.length / 5)),
      evidenceMemoryIds: sorted.map(item => item.id),
      firstSeen: sorted[0].occurredAt,
      lastSeen: sorted[sorted.length - 1].occurredAt,
      relatedEntityName: entityName === "general" ? undefined : entityName,
      status: sorted.length >= 5 ? "active" : "candidate"
    });
  }

  return patterns;
}

export function createCausalHypotheses(
  patterns: SyncoPattern[],
  memories: SyncoMemory[]
): CausalHypothesis[] {
  const hypotheses: CausalHypothesis[] = [];

  for (const pattern of patterns) {
    const evidenceMemories = memories.filter(memory =>
      pattern.evidenceMemoryIds.includes(memory.id)
    );

    const lowSleepBeforeEffects = evidenceMemories.filter(memory => {
      const sleepHours = Number(memory.metadata?.sleepHours ?? NaN);
      return Number.isFinite(sleepHours) && sleepHours > 0 && sleepHours < 6;
    });

    if (lowSleepBeforeEffects.length >= 2) {
      const confidence = clamp01(
        0.35 +
          lowSleepBeforeEffects.length * 0.1 +
          pattern.confidence * 0.3
      );

      hypotheses.push({
        hypothesisId: stableId([
          "hypothesis",
          pattern.userId,
          "low_sleep",
          pattern.patternId
        ]),
        userId: pattern.userId,
        hypothesisType: "possible_cause",
        causeSignal: "low_sleep",
        effectPatternId: pattern.patternId,
        evidenceCount: lowSleepBeforeEffects.length,
        confidence,
        strength: evidenceStrength(confidence),
        status:
          confidence >= 0.65
            ? "ready_for_experiment"
            : "needs_more_evidence"
      });
    }
  }

  return hypotheses;
}

export function predictRisks(
  userId: string,
  currentSignals: Record<string, unknown>,
  hypotheses: CausalHypothesis[]
): PredictionRisk[] {
  const risks: PredictionRisk[] = [];

  const sleepHours = Number(currentSignals.sleepHours ?? NaN);

  const lowSleepHypotheses = hypotheses.filter(
    hypothesis =>
      hypothesis.userId === userId &&
      hypothesis.causeSignal === "low_sleep" &&
      hypothesis.confidence >= 0.55
  );

  if (Number.isFinite(sleepHours) && sleepHours < 6 && lowSleepHypotheses.length > 0) {
    const avgConfidence =
      lowSleepHypotheses.reduce((sum, item) => sum + item.confidence, 0) /
      lowSleepHypotheses.length;

    const probability = clamp01(0.45 + avgConfidence * 0.35);

    risks.push({
      predictionId: stableId(["prediction", userId, "low_sleep_task_risk"]),
      userId,
      riskType: "reduced_task_completion_probability",
      probability,
      basedOnHypothesisIds: lowSleepHypotheses.map(item => item.hypothesisId),
      explanation:
        "יש אות אפשרי שבעבר שינה נמוכה הייתה קשורה לירידה בביצוע משימות. זו תחזית, לא עובדה.",
      confidence: evidenceStrength(avgConfidence)
    });
  }

  return risks;
}

export function proposeExperiments(
  hypotheses: CausalHypothesis[]
): PersonalExperiment[] {
  return hypotheses
    .filter(
      hypothesis =>
        hypothesis.status === "ready_for_experiment" &&
        hypothesis.strength !== "weak"
    )
    .map(hypothesis => ({
      experimentId: stableId(["experiment", hypothesis.userId, hypothesis.hypothesisId]),
      userId: hypothesis.userId,
      title:
        hypothesis.causeSignal === "low_sleep"
          ? "בדיקת השפעת שינה על ביצוע משימות"
          : "ניסוי אישי לבדיקת השערה",
      hypothesisId: hypothesis.hypothesisId,
      durationDays: 14,
      successMetric: "השוואת אחוז השלמת משימות בימים עם תנאים שונים",
      status: "proposed" as const
    }));
}

export function evaluateDecisionAgainstLifeRules(
  decision: DecisionCandidate,
  rules: LifeRule[]
): LifeRuleEvaluation {
  const activeRules = rules.filter(
    rule => rule.userId === decision.userId && rule.active
  );

  const blockedByRuleIds: string[] = [];
  const warnings: string[] = [];

  const decisionHour = Number(decision.metadata?.hour ?? NaN);

  for (const rule of activeRules) {
    if (
      rule.ruleType === "no_work_after_22" &&
      Number.isFinite(decisionHour) &&
      decisionHour >= 22
    ) {
      if (rule.priority === "non_negotiable") {
        blockedByRuleIds.push(rule.ruleId);
      } else {
        warnings.push(`ההחלטה מתנגשת עם החוק: ${rule.title}`);
      }
    }
  }

  return {
    allowed: blockedByRuleIds.length === 0,
    blockedByRuleIds,
    warnings
  };
}

import { applyDecayToPatterns, type DecayOptions } from './patternDecay.js';

export function runSyncoThinkingLayer(input: {
  userId: string;
  memories: SyncoMemory[];
  currentSignals?: Record<string, unknown>;
  lifeRules?: LifeRule[];
  decisionCandidate?: DecisionCandidate;
  // Phase 6: optional decay configuration
  decayOptions?: DecayOptions;
}) {
  const now = input.decayOptions?.now ?? new Date();

  // Detect raw patterns from memories
  const rawPatterns = detectPatterns(input.memories);

  // Apply time decay — older patterns lose confidence
  const patterns = applyDecayToPatterns(rawPatterns, now, input.decayOptions ?? {});

  // Only non-stale patterns feed hypothesis creation
  // Stale patterns are still returned in output for diagnostic transparency
  const nonStalePatterns = patterns.filter(p => p.status !== 'stale');

  const hypotheses = createCausalHypotheses(nonStalePatterns, input.memories);
  const predictions = predictRisks(
    input.userId,
    input.currentSignals ?? {},
    hypotheses
  );
  const experiments = proposeExperiments(hypotheses);

  const lifeRuleEvaluation =
    input.decisionCandidate && input.lifeRules
      ? evaluateDecisionAgainstLifeRules(input.decisionCandidate, input.lifeRules)
      : undefined;

  return {
    patterns,      // all patterns including stale — for transparency
    hypotheses,
    predictions,
    experiments,
    lifeRuleEvaluation
  };
}
