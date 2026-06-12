/**
 * Synco Decision Support Engine
 *
 * Combines Pattern Engine, Causality Engine, Prediction Engine, and Life Rules
 * into a single decision for a given user action or planning request.
 *
 * Design principles:
 * - Never shames or blames the user.
 * - Always explains in calm, practical Hebrew.
 * - Produces structured output — caller formats UI messages.
 * - Pure functions over typed inputs from other brain modules.
 */

import type {
  SyncoPattern,
  CausalHypothesis,
  PredictionRisk,
  LifeRule,
  LifeRuleEvaluation,
  DecisionCandidate,
} from "./syncoThinkingLayer.js";

import {
  evaluateDecisionAgainstLifeRules,
} from "./syncoThinkingLayer.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecisionType =
  | "act_now"
  | "ask_clarification"
  | "create_open_question"
  | "suggest_safer_plan"
  | "block_due_to_life_rule"
  | "warn_and_continue"
  | "defer"
  | "split_task"
  | "reduce_scope";

export interface DecisionContext {
  userId: string;
  decision: DecisionCandidate;
  activePatterns: SyncoPattern[];
  activeHypotheses: CausalHypothesis[];
  activePredictions: PredictionRisk[];
  lifeRules: LifeRule[];
  currentSignals?: Record<string, unknown>;
}

export interface SupportedDecision {
  decisionType: DecisionType;
  allowed: boolean;
  confidence: number;
  userFacingMessage: string;
  safeAlternative?: string;
  reason: string;
  blockedByRuleIds: string[];
  warnings: string[];
  internalDiagnostics: string[];
  lifeRuleEvaluation: LifeRuleEvaluation;
}

// ─── Risk threshold constants ─────────────────────────────────────────────────

const HIGH_RISK_PROBABILITY = 0.70;
const MODERATE_RISK_PROBABILITY = 0.50;

// ─── Helper: pick highest-probability prediction ──────────────────────────────

function topPrediction(predictions: PredictionRisk[]): PredictionRisk | null {
  if (predictions.length === 0) return null;
  return predictions.reduce((best, p) =>
    p.probability > best.probability ? p : best
  );
}

// ─── Helper: find patterns related to this decision ──────────────────────────

function findRelatedPatterns(
  decision: DecisionCandidate,
  patterns: SyncoPattern[]
): SyncoPattern[] {
  const title = (decision.title ?? "").toLowerCase();
  return patterns.filter(
    p =>
      p.status === "active" &&
      (title.includes(p.relatedEntityName?.toLowerCase() ?? "____") ||
        p.patternType.includes("task_completion") ||
        p.patternType.includes("delay"))
  );
}

// ─── Tone-safe message builder ────────────────────────────────────────────────

function buildUserMessage(
  type: DecisionType,
  ctx: DecisionContext,
  ruleEval: LifeRuleEvaluation,
  topPred: PredictionRisk | null
): { message: string; safeAlternative?: string } {
  const hour = Number(ctx.decision.metadata?.hour ?? NaN);
  const hasHour = Number.isFinite(hour);

  switch (type) {
    case "block_due_to_life_rule":
      return {
        message: `פעולה זו מתנגשת עם חוק חיים שהגדרת ואינה ניתנת לביצוע כרגע.`,
        safeAlternative: hasHour && hour >= 22
          ? "נסה לקבוע את זה מחר בבוקר."
          : "בדוק את החוקים שלך ושנה אם צריך.",
      };

    case "warn_and_continue":
      return {
        message: topPred
          ? `אפשר להמשיך, אבל יש אות זהירות: ${topPred.explanation}`
          : `יש כמה אותות זהירות, אבל ההחלטה בידיים שלך.`,
        safeAlternative: topPred
          ? "שקול לצמצם את הפעילות היום."
          : undefined,
      };

    case "suggest_safer_plan":
      return {
        message: `היום נראה עמוס. בהתבסס על ימים דומים בעבר, כדאי לסנן ל-3 פעולות מרכזיות.`,
        safeAlternative: "הגדר 3 משימות ליבה ודחה את השאר.",
      };

    case "reduce_scope":
      return {
        message: "המשימה נראית גדולה מהרגיל. כדאי לפרק אותה לחלקים קטנים יותר.",
        safeAlternative: "חלק למשימות של 25 דקות.",
      };

    case "defer":
      return {
        message: "עדיף לדחות זאת לזמן מתאים יותר.",
        safeAlternative: hasHour && hour >= 22
          ? "מחר בבוקר יהיה טוב יותר."
          : "קבע זמן ספציפי בלוח שנה.",
      };

    default:
      return { message: "אפשר להמשיך." };
  }
}

// ─── Main decision function ───────────────────────────────────────────────────

export function evaluateDecision(ctx: DecisionContext): SupportedDecision {
  const diagnostics: string[] = [];

  // 1. Life rules are the highest priority
  const ruleEval = evaluateDecisionAgainstLifeRules(ctx.decision, ctx.lifeRules);
  diagnostics.push(`life_rules_checked=${ctx.lifeRules.length} blocked=${ruleEval.blockedByRuleIds.length}`);

  if (ruleEval.blockedByRuleIds.length > 0) {
    const { message, safeAlternative } = buildUserMessage(
      "block_due_to_life_rule",
      ctx,
      ruleEval,
      null
    );
    return {
      decisionType: "block_due_to_life_rule",
      allowed: false,
      confidence: 0.95,
      userFacingMessage: message,
      safeAlternative,
      reason: `Blocked by life rule(s): ${ruleEval.blockedByRuleIds.join(", ")}`,
      blockedByRuleIds: ruleEval.blockedByRuleIds,
      warnings: ruleEval.warnings,
      internalDiagnostics: diagnostics,
      lifeRuleEvaluation: ruleEval,
    };
  }

  // 2. High-risk prediction → suggest safer plan
  const topPred = topPrediction(ctx.activePredictions);
  diagnostics.push(`top_prediction=${topPred ? `${topPred.riskType}@${topPred.probability.toFixed(2)}` : "none"}`);

  if (topPred && topPred.probability >= HIGH_RISK_PROBABILITY) {
    const { message, safeAlternative } = buildUserMessage(
      "suggest_safer_plan",
      ctx,
      ruleEval,
      topPred
    );
    return {
      decisionType: "suggest_safer_plan",
      allowed: true,
      confidence: topPred.probability,
      userFacingMessage: message,
      safeAlternative,
      reason: `High-probability risk detected: ${topPred.riskType} (${Math.round(topPred.probability * 100)}%)`,
      blockedByRuleIds: [],
      warnings: [topPred.explanation],
      internalDiagnostics: diagnostics,
      lifeRuleEvaluation: ruleEval,
    };
  }

  // 3. Related patterns with strong hypotheses → warn
  const relatedPatterns = findRelatedPatterns(ctx.decision, ctx.activePatterns);
  diagnostics.push(`related_patterns=${relatedPatterns.length}`);

  const strongHypotheses = ctx.activeHypotheses.filter(
    h => h.status === "ready_for_experiment" && h.confidence >= 0.65
  );
  diagnostics.push(`strong_hypotheses=${strongHypotheses.length}`);

  if (
    topPred &&
    topPred.probability >= MODERATE_RISK_PROBABILITY &&
    (relatedPatterns.length > 0 || strongHypotheses.length > 0)
  ) {
    const { message, safeAlternative } = buildUserMessage(
      "warn_and_continue",
      ctx,
      ruleEval,
      topPred
    );
    return {
      decisionType: "warn_and_continue",
      allowed: true,
      confidence: topPred.probability,
      userFacingMessage: message,
      safeAlternative,
      reason: `Moderate risk with supporting patterns/hypotheses.`,
      blockedByRuleIds: [],
      warnings: ruleEval.warnings,
      internalDiagnostics: diagnostics,
      lifeRuleEvaluation: ruleEval,
    };
  }

  // 4. Life rule warnings only
  if (ruleEval.warnings.length > 0) {
    return {
      decisionType: "warn_and_continue",
      allowed: true,
      confidence: 0.7,
      userFacingMessage: ruleEval.warnings.join(" "),
      reason: "Non-blocking life rule warning.",
      blockedByRuleIds: [],
      warnings: ruleEval.warnings,
      internalDiagnostics: diagnostics,
      lifeRuleEvaluation: ruleEval,
    };
  }

  // 5. All clear
  return {
    decisionType: "act_now",
    allowed: true,
    confidence: 0.9,
    userFacingMessage: "אפשר להמשיך.",
    reason: "No patterns, rules, or risks contraindicate this action.",
    blockedByRuleIds: [],
    warnings: [],
    internalDiagnostics: diagnostics,
    lifeRuleEvaluation: ruleEval,
  };
}
