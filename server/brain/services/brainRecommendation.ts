/**
 * Synco Brain Recommendation — Phase 7
 *
 * Converts brain pipeline decision-support output into a single
 * user-facing Hebrew recommendation.
 *
 * Priority order (first match wins):
 *   1. Life rule block         → tell user which rule, suggest moving task
 *   2. High risk prediction    → gentle heads-up, suggest starting small
 *   3. Overload warning        → suggest focusing on 3 key tasks
 *   4. Missing info            → ask for more context
 *   5. null                    → no recommendation needed
 *
 * Output is always Hebrew (via localization layer).
 * Severity: 'block' | 'warning' | 'info'.
 */

import { t } from '../localization/index.js';
import type { SyncoPattern } from './syncoThinkingLayer.js';
import type { LifeRule }     from './lifeRuleLoader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationSeverity = 'block' | 'warning' | 'info';

export interface BrainRecommendation {
  severity:       RecommendationSeverity;
  message:        string;           // Hebrew user-facing message
  reason:         string;           // Hebrew brief reason
  suggestedAction: string;          // Hebrew actionable suggestion
  basedOn:        string[];         // internal: what triggered this (for diagnostics)
}

// ─── Input context ────────────────────────────────────────────────────────────

export interface RecommendationContext {
  /** Life rules that were violated by the current task/time slot */
  blockedByLifeRules?: LifeRule[];
  /** Patterns with status 'active' and trendDiagnostics.penaltyApplied = true */
  contradictedActivePatterns?: SyncoPattern[];
  /** Whether the current task load for the day is high (caller decides threshold) */
  isOverloaded?: boolean;
  /** Whether key context fields are missing (e.g., no project, no person ID) */
  hasMissingContext?: boolean;
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * generateRecommendation — returns one BrainRecommendation or null.
 *
 * Returns null when nothing notable was detected (happy path).
 */
export function generateRecommendation(
  ctx: RecommendationContext,
): BrainRecommendation | null {
  // 1. Life rule block — highest priority
  if (ctx.blockedByLifeRules && ctx.blockedByLifeRules.length > 0) {
    const rule = ctx.blockedByLifeRules[0];
    return {
      severity:        'block',
      message:         t.recommendation.lifeRuleBlock(rule.title),
      reason:          t.recommendation.lifeRuleBlockReason,
      suggestedAction: t.recommendation.lifeRuleBlockAction,
      basedOn:         [`life_rule:${rule.ruleId}`],
    };
  }

  // 2. High risk prediction — contradicted active pattern signals risk
  if (ctx.contradictedActivePatterns && ctx.contradictedActivePatterns.length > 0) {
    return {
      severity:        'warning',
      message:         t.recommendation.highRiskPrediction,
      reason:          t.recommendation.highRiskPredictionReason,
      suggestedAction: t.recommendation.highRiskPredictionAction,
      basedOn:         ctx.contradictedActivePatterns.map(p => `pattern:${p.patternId}`),
    };
  }

  // 3. Overload warning
  if (ctx.isOverloaded) {
    return {
      severity:        'warning',
      message:         t.recommendation.overloadWarning,
      reason:          t.recommendation.overloadWarningReason,
      suggestedAction: t.recommendation.overloadWarningAction,
      basedOn:         ['overload_detection'],
    };
  }

  // 4. Missing info
  if (ctx.hasMissingContext) {
    return {
      severity:        'info',
      message:         t.recommendation.missingInfo,
      reason:          t.recommendation.missingInfoReason,
      suggestedAction: t.recommendation.missingInfoAction,
      basedOn:         ['missing_context'],
    };
  }

  return null;
}
