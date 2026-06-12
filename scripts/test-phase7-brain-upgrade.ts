/**
 * Synco Phase 7 — Brain Upgrade Tests
 *
 * Coverage:
 * 1.  Evidence guard: no guard below threshold (evidenceCount < 5)
 * 2.  Evidence guard: guard applied above threshold (evidenceCount >= 5)
 * 3.  Evidence guard: cannot increase confidence above raw
 * 4.  Evidence guard: diagnostics fields populated correctly
 * 5.  Trend: insufficient data (< 3 recent events)
 * 6.  Trend: reinforcing (recent events match pattern type)
 * 7.  Trend: contradicting applies 0.5 penalty
 * 8.  Trend: neutral (unrelated events, no penalty)
 * 9.  Trend: penalty cannot make confidence negative
 * 10. Explainability: summary contains patternName
 * 11. Explainability: confidencePath reflects full pipeline
 * 12. Recommendation: lifeRuleBlock highest priority
 * 13. Recommendation: highRiskPrediction when contradicted active pattern
 * 14. Recommendation: null when no issues
 * 15. Localization: Hebrew text in recommendation
 * 16. Full pipeline: decay → guard → trend → explainability → recommendation
 */

import {
  calculateDecayFactor,
  calculateEvidenceGuardFactor,
  applyPatternDecay,
  EVIDENCE_GUARD_MIN_COUNT,
  EVIDENCE_GUARD_MAX_SLOWDOWN,
  DECAY_THRESHOLD_ACTIVE,
} from '../server/brain/services/patternDecay.js';

import {
  applyTrendOverride,
  RECENT_WINDOW_DAYS,
  MINIMUM_RECENT_EVIDENCE,
  CONTRADICTION_PENALTY_FACTOR,
} from '../server/brain/services/recentTrendAnalyzer.js';

import { explainPattern } from '../server/brain/services/patternExplainability.js';

import { generateRecommendation } from '../server/brain/services/brainRecommendation.js';

import type { SyncoPattern } from '../server/brain/services/syncoThinkingLayer.js';
import type { SyncoMemory, LifeRule } from '../server/brain/services/syncoThinkingLayer.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
    errors.push(label);
  }
}

function makePattern(overrides: Partial<SyncoPattern> = {}): SyncoPattern {
  return {
    patternId:         'pat-001',
    userId:            'user-001',
    patternType:       'task_completed_on_time',
    patternName:       'task_completed_on_time_general',
    evidenceCount:     3,
    confidence:        0.75,
    evidenceMemoryIds: ['m1', 'm2', 'm3'],
    firstSeen:         new Date(Date.now() - 60 * 86_400_000).toISOString(), // 60d ago
    lastSeen:          new Date(Date.now() - 5 * 86_400_000).toISOString(),  // 5d ago
    status:            'active',
    ...overrides,
  };
}

function makeMemory(overrides: Partial<SyncoMemory> = {}): SyncoMemory {
  return {
    id:         `mem-${Math.random().toString(36).slice(2)}`,
    userId:     'user-001',
    memoryKind: 'task_completed_on_time',
    occurredAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), // 3d ago (recent)
    source:     'observed',
    confidence: 0.8,
    ...overrides,
  };
}

function makeLifeRule(overrides: Partial<LifeRule> = {}): LifeRule {
  return {
    ruleId:   'rule-001',
    userId:   'user-001',
    ruleType: 'no_work_after_22',
    title:    'אין עבודה אחרי 22:00',
    priority: 'non_negotiable',
    active:   true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Phase 7 Brain Upgrade Tests ===\n');

// ── 1. Evidence guard: no guard below threshold
console.log('Test 1: Evidence guard — no guard below threshold');
{
  const factor = calculateEvidenceGuardFactor(EVIDENCE_GUARD_MIN_COUNT - 1);
  assert(factor === 1, `evidenceCount=${EVIDENCE_GUARD_MIN_COUNT - 1} → factor === 1 (got ${factor})`);
}

// ── 2. Evidence guard: guard applied above threshold
console.log('Test 2: Evidence guard — guard applied above threshold');
{
  const factor = calculateEvidenceGuardFactor(EVIDENCE_GUARD_MIN_COUNT + 1);
  assert(factor > 1, `evidenceCount=${EVIDENCE_GUARD_MIN_COUNT + 1} → factor > 1 (got ${factor})`);
  assert(factor <= 1 + EVIDENCE_GUARD_MAX_SLOWDOWN, `factor <= 1 + MAX_SLOWDOWN (got ${factor})`);
}

// ── 3. Evidence guard: cannot increase confidence above raw
console.log('Test 3: Evidence guard — confidence capped at raw');
{
  const pattern = makePattern({ evidenceCount: 100, confidence: 0.9, lastSeen: new Date(Date.now() - 1000).toISOString() });
  const result = applyPatternDecay(pattern);
  assert(result.confidence <= (pattern.rawConfidence ?? pattern.confidence), 'guard cannot raise confidence above rawConfidence');
}

// ── 4. Evidence guard: diagnostics populated
console.log('Test 4: Evidence guard — diagnostics fields');
{
  const pattern = makePattern({ evidenceCount: 20, lastSeen: new Date(Date.now() - 10 * 86_400_000).toISOString() });
  const result = applyPatternDecay(pattern);
  const d = result.decayDiagnostics!;
  assert(d !== undefined, 'decayDiagnostics present');
  assert(typeof d.evidenceCountGuardApplied === 'boolean', 'evidenceCountGuardApplied is boolean');
  assert(typeof d.confidenceBeforeGuard === 'number', 'confidenceBeforeGuard is number');
  assert(typeof d.confidenceAfterGuard === 'number', 'confidenceAfterGuard is number');
  assert(d.evidenceGuardFactor >= 1, `evidenceGuardFactor >= 1 (got ${d.evidenceGuardFactor})`);
  assert(d.evidenceCountGuardApplied === true, 'guard was applied (evidenceCount=20)');
}

// ── 5. Trend: insufficient data
console.log('Test 5: Trend — insufficient data (< 3 recent events)');
{
  const pattern = makePattern();
  const memories = [makeMemory()]; // only 1 — below MINIMUM_RECENT_EVIDENCE
  const [, trend] = applyTrendOverride(pattern, memories);
  assert(trend.status === 'insufficient_data', `status=insufficient_data (got ${trend.status})`);
  assert(!trend.penaltyApplied, 'no penalty when insufficient data');
}

// ── 6. Trend: reinforcing
console.log('Test 6: Trend — reinforcing (matching recent events)');
{
  const pattern = makePattern({ patternType: 'task_completed_on_time', confidence: 0.7 });
  const memories = [
    makeMemory({ memoryKind: 'task_completed_on_time' }),
    makeMemory({ memoryKind: 'task_completed_on_time' }),
    makeMemory({ memoryKind: 'task_completed_on_time' }),
  ];
  const [updated, trend] = applyTrendOverride(pattern, memories);
  assert(trend.status === 'reinforcing', `status=reinforcing (got ${trend.status})`);
  assert(!trend.penaltyApplied, 'no penalty for reinforcing trend');
  assert(updated.confidence === pattern.confidence, 'confidence unchanged when reinforcing');
}

// ── 7. Trend: contradicting applies 0.5 penalty
console.log('Test 7: Trend — contradicting applies penalty');
{
  const pattern = makePattern({ patternType: 'task_completed_on_time', confidence: 0.8 });
  const memories = [
    makeMemory({ memoryKind: 'task_rescheduled' }),
    makeMemory({ memoryKind: 'task_rescheduled' }),
    makeMemory({ memoryKind: 'task_rescheduled' }),
    makeMemory({ memoryKind: 'task_rescheduled' }),
  ];
  const [updated, trend] = applyTrendOverride(pattern, memories);
  assert(trend.status === 'contradicting', `status=contradicting (got ${trend.status})`);
  assert(trend.penaltyApplied, 'penalty applied');
  assert(trend.penaltyFactor === CONTRADICTION_PENALTY_FACTOR, `penaltyFactor=${CONTRADICTION_PENALTY_FACTOR} (got ${trend.penaltyFactor})`);
  const expectedConfidence = pattern.confidence * CONTRADICTION_PENALTY_FACTOR;
  assert(Math.abs(updated.confidence - expectedConfidence) < 0.001, `confidence × 0.5 (expected ${expectedConfidence}, got ${updated.confidence})`);
}

// ── 8. Trend: neutral (unrelated events)
console.log('Test 8: Trend — neutral (unrelated events)');
{
  const pattern = makePattern({ patternType: 'morning_focus', relatedEntityName: undefined, confidence: 0.7 });
  const memories = [
    makeMemory({ memoryKind: 'unrelated_event_xyz' }),
    makeMemory({ memoryKind: 'unrelated_event_xyz' }),
    makeMemory({ memoryKind: 'unrelated_event_xyz' }),
  ];
  const [updated, trend] = applyTrendOverride(pattern, memories);
  assert(trend.status === 'neutral', `status=neutral (got ${trend.status})`);
  assert(!trend.penaltyApplied, 'no penalty for neutral trend');
  assert(updated.confidence === pattern.confidence, 'confidence unchanged');
}

// ── 9. Trend: penalty cannot make confidence negative
console.log('Test 9: Trend — penalty floor is 0');
{
  const pattern = makePattern({ confidence: 0.01, patternType: 'task_completed_on_time' });
  const memories = Array.from({ length: 4 }, () => makeMemory({ memoryKind: 'task_rescheduled' }));
  const [updated] = applyTrendOverride(pattern, memories);
  assert(updated.confidence >= 0, `confidence >= 0 (got ${updated.confidence})`);
}

// ── 10. Explainability: summary contains patternName
console.log('Test 10: Explainability — summary contains patternName');
{
  const pattern = makePattern();
  const decayed = applyPatternDecay(pattern);
  const explanation = explainPattern(decayed);
  assert(explanation.summary.includes(pattern.patternName), `summary includes "${pattern.patternName}"`);
  assert(typeof explanation.confidenceSignal === 'string', 'confidenceSignal is string');
  assert(Array.isArray(explanation.keyFactors), 'keyFactors is array');
  assert(explanation.keyFactors.length > 0, 'keyFactors non-empty');
}

// ── 11. Explainability: confidencePath reflects full pipeline
console.log('Test 11: Explainability — confidencePath present');
{
  const pattern = makePattern({ evidenceCount: 10 });
  const decayed = applyPatternDecay(pattern);
  const explanation = explainPattern(decayed);
  assert(explanation.confidencePath.raw > 0, 'confidencePath.raw > 0');
  assert(explanation.confidencePath.final >= 0, 'confidencePath.final >= 0');
  assert(explanation.confidencePath.afterDecay !== null, 'afterDecay populated after decay step');
}

// ── 12. Recommendation: lifeRuleBlock is highest priority
console.log('Test 12: Recommendation — lifeRuleBlock wins over contradictions');
{
  const rule = makeLifeRule();
  const contradictedPattern = makePattern({ status: 'active' });
  // Force trendDiagnostics to have penaltyApplied=true
  contradictedPattern.trendDiagnostics = {
    status: 'contradicting',
    recentEventCount: 4,
    recentWindowDays: RECENT_WINDOW_DAYS,
    penaltyApplied: true,
    penaltyFactor: 0.5,
    confidenceBeforeTrend: 0.7,
    confidenceAfterTrend: 0.35,
  };
  const rec = generateRecommendation({
    blockedByLifeRules: [rule],
    contradictedActivePatterns: [contradictedPattern],
  });
  assert(rec !== null, 'recommendation generated');
  assert(rec!.severity === 'block', `severity=block (got ${rec?.severity})`);
  assert(rec!.message.includes(rule.title), 'message includes rule title');
}

// ── 13. Recommendation: highRiskPrediction for contradicted pattern
console.log('Test 13: Recommendation — highRiskPrediction (contradicted pattern, no rule block)');
{
  const pattern = makePattern({ status: 'active' });
  pattern.trendDiagnostics = {
    status: 'contradicting',
    recentEventCount: 4,
    recentWindowDays: RECENT_WINDOW_DAYS,
    penaltyApplied: true,
    penaltyFactor: 0.5,
    confidenceBeforeTrend: 0.7,
    confidenceAfterTrend: 0.35,
  };
  const rec = generateRecommendation({ contradictedActivePatterns: [pattern] });
  assert(rec !== null, 'recommendation generated');
  assert(rec!.severity === 'warning', `severity=warning (got ${rec?.severity})`);
  assert(rec!.basedOn.some(b => b.includes(pattern.patternId)), 'basedOn includes patternId');
}

// ── 14. Recommendation: null when no issues
console.log('Test 14: Recommendation — null when nothing detected');
{
  const rec = generateRecommendation({});
  assert(rec === null, 'null recommendation when context is empty');
}

// ── 15. Localization: Hebrew text
console.log('Test 15: Localization — Hebrew text in recommendation');
{
  const rec = generateRecommendation({ isOverloaded: true });
  assert(rec !== null, 'overload recommendation generated');
  // Hebrew characters range U+05D0–U+05EA
  const hasHebrew = /[א-ת]/.test(rec!.message);
  assert(hasHebrew, 'message contains Hebrew characters');
}

// ── 16. Full pipeline: decay → guard → trend → explainability
console.log('Test 16: Full pipeline integration');
{
  const rawPattern = makePattern({
    evidenceCount: 10,
    confidence: 0.8,
    patternType: 'task_completed_on_time',
    lastSeen: new Date(Date.now() - 7 * 86_400_000).toISOString(), // 7d ago
  });

  // Step 1: decay + guard
  const decayed = applyPatternDecay(rawPattern);
  assert(decayed.decayDiagnostics !== undefined, 'decayDiagnostics present after decay');
  assert(decayed.decayDiagnostics!.evidenceCountGuardApplied === true, 'guard applied (evidenceCount=10)');

  // Step 2: trend (contradicting)
  const memories = Array.from({ length: 4 }, () => makeMemory({ memoryKind: 'task_rescheduled' }));
  const [trended, trend] = applyTrendOverride(decayed, memories);
  assert(trend.penaltyApplied, 'trend penalty applied');
  assert(trended.confidence < decayed.confidence, 'confidence reduced by trend');

  // Step 3: explainability
  const explanation = explainPattern(trended);
  assert(explanation.warnings.some(w => w.includes('contradict')), 'warning about contradiction');
  assert(explanation.confidencePath.afterTrend !== null, 'afterTrend populated');

  // Step 4: recommendation
  trended.trendDiagnostics = trend;
  const rec = generateRecommendation({ contradictedActivePatterns: [trended] });
  assert(rec !== null, 'recommendation generated from full pipeline');
  assert(rec!.severity === 'warning', 'severity is warning');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (errors.length > 0) {
  console.error('\nFailed tests:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ All Phase 7 tests passed.');
}
