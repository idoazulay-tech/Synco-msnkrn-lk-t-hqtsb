/**
 * Phase 6 Pattern Decay Tests
 *
 * T1  — calculateDecayFactor: factor = 1.0 when daysSince = 0
 * T2  — calculateDecayFactor: factor ≈ 0.368 at daysSince = halfLifeDays (30)
 * T3  — calculateDecayFactor: factor ≈ 0.050 at daysSince = 3× halfLife (90)
 * T4  — calculateDecayFactor: never < 0, never > 1
 * T5  — applyPatternDecay: confidence unchanged for today's pattern
 * T6  — applyPatternDecay: confidence decays meaningfully at 30 days
 * T7  — applyPatternDecay: pattern from 90 days ago becomes stale
 * T8  — applyPatternDecay: rawConfidence preserved in output
 * T9  — applyPatternDecay: decayDiagnostics populated correctly
 * T10 — applyPatternDecay: status = active when decayed confidence >= 0.55
 * T11 — applyPatternDecay: status = candidate when 0.35 <= confidence < 0.55
 * T12 — applyPatternDecay: status = stale when confidence < 0.35
 * T13 — applyDecayToPatterns: all patterns returned (including stale)
 * T14 — applyDecayToPatterns: original pattern objects not mutated
 * T15 — runSyncoThinkingLayer: recent pattern keeps hypothesis
 * T16 — runSyncoThinkingLayer: stale pattern does NOT create hypothesis
 * T17 — runSyncoThinkingLayer: stale pattern still appears in patterns output
 * T18 — runSyncoThinkingLayer: custom halfLifeDays changes decay speed
 * T19 — regression: existing brain tests still pass with decay
 */

import {
  calculateDecayFactor,
  applyPatternDecay,
  applyDecayToPatterns,
  DEFAULT_HALF_LIFE_DAYS,
  DECAY_THRESHOLD_ACTIVE,
  DECAY_THRESHOLD_CANDIDATE,
} from '../server/brain/services/patternDecay.js';

import {
  runSyncoThinkingLayer,
  detectPatterns,
  type SyncoMemory,
  type SyncoPattern,
} from '../server/brain/services/syncoThinkingLayer.js';

let passed = 0;
let failed = 0;
const userId = 'phase6-test-user';

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ ${label}`); failed++; }
}
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }

// ─── Reference time for deterministic tests ───────────────────────────────────

/** Fixed "now" used throughout tests so results don't depend on run date */
const NOW = new Date('2026-06-12T12:00:00.000Z');

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

// ─── Minimal pattern fixture ──────────────────────────────────────────────────

function makePattern(
  lastSeenDaysAgo: number,
  rawConfidence: number = 0.80,
  status: 'active' | 'candidate' = rawConfidence >= 0.55 ? 'active' : 'candidate',
): SyncoPattern {
  const lastSeen = daysAgo(lastSeenDaysAgo);
  return {
    patternId: `p-${lastSeenDaysAgo}`,
    userId,
    patternType: 'task_completion_failed',
    patternName: 'task_completion_failed_test',
    evidenceCount: 5,
    confidence: rawConfidence,
    evidenceMemoryIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
    firstSeen: daysAgo(lastSeenDaysAgo + 7),
    lastSeen,
    status,
  };
}

// ─── Minimal memories fixture (with sleep signal) ────────────────────────────

function makeMemoriesWithSleep(lastSeenDaysAgo: number, count: number = 4): SyncoMemory[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    userId,
    memoryKind: 'task_completion_failed',
    entityType: 'task',
    entityName: 'morning',
    occurredAt: daysAgo(lastSeenDaysAgo - i),
    source: 'observed' as const,
    confidence: 0.80,
    metadata: { sleepHours: 5 },
  }));
}

// ─── T1: factor = 1.0 at 0 days ──────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(' Phase 6 Pattern Decay Tests');
console.log('══════════════════════════════════════════════════════════════════\n');

console.log('── T1: calculateDecayFactor at 0 days ───────────────────────────');
{
  const f = calculateDecayFactor(0, 30);
  ok('T1: factor = 1.0 at 0 days', f === 1);
  info(`T1: factor=${f}`);
}

// ─── T2: factor ≈ 0.368 at halfLifeDays ──────────────────────────────────────

console.log('\n── T2: calculateDecayFactor at 30 days ──────────────────────────');
{
  const f = calculateDecayFactor(30, 30);
  ok('T2: factor ≈ 0.368 at halfLife', Math.abs(f - Math.exp(-1)) < 0.0001);
  ok('T2: factor in (0.36, 0.37)', f > 0.36 && f < 0.37);
  info(`T2: factor=${f.toFixed(4)} (e^-1 ≈ 0.3679)`);
}

// ─── T3: factor ≈ 0.050 at 90 days ───────────────────────────────────────────

console.log('\n── T3: calculateDecayFactor at 90 days ──────────────────────────');
{
  const f = calculateDecayFactor(90, 30);
  ok('T3: factor ≈ 0.050 at 3× halfLife', Math.abs(f - Math.exp(-3)) < 0.0001);
  ok('T3: factor < 0.06', f < 0.06);
  info(`T3: factor=${f.toFixed(4)} (e^-3 ≈ 0.0498)`);
}

// ─── T4: factor always in [0, 1] ─────────────────────────────────────────────

console.log('\n── T4: factor always in [0, 1] ──────────────────────────────────');
{
  const cases = [0, 1, 7, 30, 90, 365, 1000];
  for (const days of cases) {
    const f = calculateDecayFactor(days, 30);
    ok(`T4: factor in [0,1] at ${days}d`, f >= 0 && f <= 1);
  }
  // Edge: negative days → clamped to factor 1
  const negFactor = calculateDecayFactor(-5, 30);
  ok('T4: negative days → factor = 1', negFactor === 1);
  // Edge: zero halfLife → factor = 1 (guard)
  const zeroHL = calculateDecayFactor(30, 0);
  ok('T4: zero halfLife → factor = 1', zeroHL === 1);
}

// ─── T5: today's pattern confidence unchanged ─────────────────────────────────

console.log('\n── T5: today\'s pattern confidence unchanged ──────────────────────');
{
  const pattern = makePattern(0, 0.80);
  const decayed = applyPatternDecay(pattern, NOW);

  ok('T5: confidence unchanged (within 0.001)', Math.abs(decayed.confidence - 0.80) < 0.001);
  ok('T5: status stays active', decayed.status === 'active');
  ok('T5: rawConfidence = 0.80', decayed.rawConfidence === 0.80);
  info(`T5: raw=${pattern.confidence} → decayed=${decayed.confidence.toFixed(4)} (0 days)`);
}

// ─── T6: 30-day-old pattern decays meaningfully ───────────────────────────────

console.log('\n── T6: 30-day pattern decays meaningfully ────────────────────────');
{
  const pattern = makePattern(30, 0.80);
  const decayed = applyPatternDecay(pattern, NOW);

  ok('T6: confidence dropped by > 50%', decayed.confidence < 0.80 * 0.5);
  ok('T6: confidence = raw × e^-1', Math.abs(decayed.confidence - 0.80 * Math.exp(-1)) < 0.001);
  ok('T6: rawConfidence preserved', decayed.rawConfidence === 0.80);
  info(`T6: raw=0.80 → decayed=${decayed.confidence.toFixed(4)} status=${decayed.status}`);
}

// ─── T7: 90-day-old pattern becomes stale ────────────────────────────────────

console.log('\n── T7: 90-day pattern becomes stale ─────────────────────────────');
{
  const pattern = makePattern(90, 0.80);
  const decayed = applyPatternDecay(pattern, NOW);

  ok('T7: status = stale', decayed.status === 'stale');
  ok('T7: confidence < DECAY_THRESHOLD_CANDIDATE', decayed.confidence < DECAY_THRESHOLD_CANDIDATE);
  ok('T7: confidence ≈ 0.80 × e^-3', Math.abs(decayed.confidence - 0.80 * Math.exp(-3)) < 0.001);
  info(`T7: raw=0.80 → decayed=${decayed.confidence.toFixed(4)} (stale threshold=${DECAY_THRESHOLD_CANDIDATE})`);
}

// ─── T8: rawConfidence preserved correctly ───────────────────────────────────

console.log('\n── T8: rawConfidence preserved ───────────────────────────────────');
{
  const pattern = makePattern(15, 0.72);
  const decayed = applyPatternDecay(pattern, NOW);

  ok('T8: rawConfidence = 0.72', decayed.rawConfidence === 0.72);
  ok('T8: confidence != rawConfidence (decay applied)', decayed.confidence !== 0.72);
  ok('T8: confidence < rawConfidence', decayed.confidence < 0.72);

  // Applying decay again should not compound on already-decayed value
  // (rawConfidence is read from pattern.rawConfidence if present)
  const doubleDecayed = applyPatternDecay(decayed, NOW);
  ok('T8: double-apply uses rawConfidence (idempotent base)', doubleDecayed.rawConfidence === 0.72);
}

// ─── T9: decayDiagnostics populated correctly ────────────────────────────────

console.log('\n── T9: decayDiagnostics fields ──────────────────────────────────');
{
  const pattern = makePattern(30, 0.75);
  const decayed = applyPatternDecay(pattern, NOW);
  const d = decayed.decayDiagnostics!;

  ok('T9: decayDiagnostics present', d !== undefined);
  ok('T9: rawConfidence = 0.75', d.rawConfidence === 0.75);
  ok('T9: decayedConfidence in (0, 0.75)', d.decayedConfidence > 0 && d.decayedConfidence < 0.75);
  ok('T9: daysSinceLastSeen ≈ 30', Math.abs(d.daysSinceLastSeen - 30) < 0.5);
  ok('T9: decayFactor ≈ 0.368', Math.abs(d.decayFactor - 0.3679) < 0.001);
  ok('T9: halfLifeDays = DEFAULT_HALF_LIFE_DAYS', d.halfLifeDays === DEFAULT_HALF_LIFE_DAYS);
  ok('T9: statusBefore present', typeof d.statusBefore === 'string');
  ok('T9: statusAfter is valid', ['active', 'candidate', 'stale'].includes(d.statusAfter));
  info(`T9: days=${d.daysSinceLastSeen} factor=${d.decayFactor} → ${d.statusBefore}→${d.statusAfter}`);
}

// ─── T10: status = active when decayed >= 0.55 ───────────────────────────────

console.log('\n── T10: status = active when decayed confidence >= 0.55 ─────────');
{
  // 0 days, confidence 0.80 → no decay → 0.80 >= 0.55 → active
  const p = makePattern(0, 0.80);
  const d = applyPatternDecay(p, NOW);
  ok('T10: status = active', d.status === 'active');
  ok('T10: confidence >= 0.55', d.confidence >= DECAY_THRESHOLD_ACTIVE);
  info(`T10: confidence=${d.confidence.toFixed(4)} status=${d.status}`);
}

// ─── T11: status = candidate when 0.35 <= decayed < 0.55 ─────────────────────

console.log('\n── T11: status = candidate when 0.35 ≤ confidence < 0.55 ────────');
{
  // Choose days/confidence so decayed lands in [0.35, 0.55)
  // raw=0.80, days=15: factor=e^(-0.5)≈0.607, decayed=0.485 → candidate
  const p = makePattern(15, 0.80);
  const d = applyPatternDecay(p, NOW);
  ok('T11: status = candidate', d.status === 'candidate');
  ok('T11: confidence in [0.35, 0.55)', d.confidence >= DECAY_THRESHOLD_CANDIDATE && d.confidence < DECAY_THRESHOLD_ACTIVE);
  info(`T11: confidence=${d.confidence.toFixed(4)} status=${d.status}`);
}

// ─── T12: status = stale when decayed < 0.35 ─────────────────────────────────

console.log('\n── T12: status = stale when confidence < 0.35 ───────────────────');
{
  // raw=0.80, days=30: decayed≈0.294 → stale
  const p = makePattern(30, 0.80);
  const d = applyPatternDecay(p, NOW);
  ok('T12: status = stale', d.status === 'stale');
  ok('T12: confidence < 0.35', d.confidence < DECAY_THRESHOLD_CANDIDATE);
  info(`T12: confidence=${d.confidence.toFixed(4)} (stale threshold=${DECAY_THRESHOLD_CANDIDATE})`);
}

// ─── T13: applyDecayToPatterns returns all patterns (including stale) ─────────

console.log('\n── T13: applyDecayToPatterns returns ALL patterns ────────────────');
{
  const patterns = [
    makePattern(0, 0.80),   // active
    makePattern(15, 0.80),  // candidate
    makePattern(90, 0.80),  // stale
  ];
  const decayed = applyDecayToPatterns(patterns, NOW);

  ok('T13: returns same count', decayed.length === 3);
  ok('T13: first = active', decayed[0].status === 'active');
  ok('T13: second = candidate', decayed[1].status === 'candidate');
  ok('T13: third = stale', decayed[2].status === 'stale');
  info(`T13: statuses=${decayed.map(p => p.status).join(', ')}`);
}

// ─── T14: original pattern objects not mutated ────────────────────────────────

console.log('\n── T14: original pattern objects not mutated ────────────────────');
{
  const original = makePattern(90, 0.80);
  const originalConfidence = original.confidence;
  const originalStatus = original.status;

  applyPatternDecay(original, NOW);

  ok('T14: original.confidence unchanged', original.confidence === originalConfidence);
  ok('T14: original.status unchanged', original.status === originalStatus);
  ok('T14: original.rawConfidence still undefined', original.rawConfidence === undefined);
  ok('T14: original.decayDiagnostics still undefined', original.decayDiagnostics === undefined);
  info('T14: immutability confirmed');
}

// ─── T15: recent pattern keeps hypothesis ────────────────────────────────────

console.log('\n── T15: recent pattern keeps hypothesis ──────────────────────────');
{
  // Memories from 1-4 days ago — very recent, minimal decay
  const memories: SyncoMemory[] = Array.from({ length: 4 }, (_, i) => ({
    id: `r${i + 1}`,
    userId,
    memoryKind: 'task_completion_failed',
    entityType: 'task',
    entityName: 'morning',
    occurredAt: daysAgo(i + 1),
    source: 'observed' as const,
    confidence: 0.80,
    metadata: { sleepHours: 5 },
  }));

  const result = runSyncoThinkingLayer({
    userId,
    memories,
    currentSignals: { sleepHours: 5 },
    decayOptions: { now: NOW },
  });

  ok('T15: pattern exists', result.patterns.length >= 1);
  ok('T15: pattern not stale', result.patterns[0].status !== 'stale');
  ok('T15: hypothesis created', result.hypotheses.length >= 1);
  ok('T15: low_sleep hypothesis', result.hypotheses.some(h => h.causeSignal === 'low_sleep'));
  ok('T15: prediction generated', result.predictions.length >= 1);
  info(`T15: pattern status=${result.patterns[0].status} conf=${result.patterns[0].confidence.toFixed(3)}`);
}

// ─── T16: stale pattern does NOT create hypothesis ───────────────────────────

console.log('\n── T16: stale pattern does NOT create hypothesis ────────────────');
{
  // Memories from 90-93 days ago — will produce stale pattern
  const memories: SyncoMemory[] = Array.from({ length: 4 }, (_, i) => ({
    id: `old${i + 1}`,
    userId,
    memoryKind: 'task_completion_failed',
    entityType: 'task',
    entityName: 'morning',
    occurredAt: daysAgo(90 + i),
    source: 'observed' as const,
    confidence: 0.80,
    metadata: { sleepHours: 5 },
  }));

  const result = runSyncoThinkingLayer({
    userId,
    memories,
    currentSignals: { sleepHours: 5 },
    decayOptions: { now: NOW },
  });

  ok('T16: stale pattern detected', result.patterns.some(p => p.status === 'stale'));
  ok('T16: no hypotheses from stale pattern', result.hypotheses.length === 0);
  ok('T16: no predictions from stale pattern', result.predictions.length === 0);
  info(`T16: pattern status=${result.patterns[0]?.status} hypotheses=${result.hypotheses.length}`);
}

// ─── T17: stale pattern still appears in patterns output ─────────────────────

console.log('\n── T17: stale patterns appear in output (transparency) ──────────');
{
  const memories: SyncoMemory[] = Array.from({ length: 4 }, (_, i) => ({
    id: `stale${i + 1}`,
    userId,
    memoryKind: 'task_completion_failed',
    entityType: 'task',
    entityName: 'morning',
    occurredAt: daysAgo(90 + i),
    source: 'observed' as const,
    confidence: 0.80,
    metadata: { sleepHours: 5 },
  }));

  const result = runSyncoThinkingLayer({
    userId,
    memories,
    decayOptions: { now: NOW },
  });

  ok('T17: stale pattern in patterns array', result.patterns.length >= 1);
  ok('T17: stale pattern has status stale', result.patterns.some(p => p.status === 'stale'));
  ok('T17: stale pattern has decayDiagnostics', result.patterns[0]?.decayDiagnostics !== undefined);
  ok('T17: stale pattern has rawConfidence', result.patterns[0]?.rawConfidence !== undefined);
  info(`T17: ${result.patterns.length} patterns returned (stale but visible)`);
}

// ─── T18: custom halfLifeDays changes decay speed ────────────────────────────

console.log('\n── T18: custom halfLifeDays changes decay speed ──────────────────');
{
  const pattern = makePattern(7, 0.80);

  // Default 30-day half-life: 7 days → e^(-7/30) ≈ 0.794
  const defaultDecay = applyPatternDecay(pattern, NOW);
  // Aggressive 7-day half-life: 7 days → e^(-1) ≈ 0.368
  const aggressiveDecay = applyPatternDecay(pattern, NOW, { halfLifeDays: 7 });
  // Conservative 90-day half-life: 7 days → e^(-7/90) ≈ 0.925
  const conservativeDecay = applyPatternDecay(pattern, NOW, { halfLifeDays: 90 });

  ok('T18: aggressive < default', aggressiveDecay.confidence < defaultDecay.confidence);
  ok('T18: default < conservative', defaultDecay.confidence < conservativeDecay.confidence);
  ok('T18: aggressive halfLife in diagnostics', aggressiveDecay.decayDiagnostics?.halfLifeDays === 7);
  ok('T18: conservative halfLife in diagnostics', conservativeDecay.decayDiagnostics?.halfLifeDays === 90);
  info(`T18: aggressive=${aggressiveDecay.confidence.toFixed(3)} default=${defaultDecay.confidence.toFixed(3)} conservative=${conservativeDecay.confidence.toFixed(3)}`);
}

// ─── T19: regression — existing brain tests still pass with decay ─────────────

console.log('\n── T19: regression — existing brain behavior with decay ──────────');
{
  // Same fixture as prior regression tests, but with explicit now
  const memories: SyncoMemory[] = [
    { id: 'rg1', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: daysAgo(11), source: 'observed', confidence: 0.80, metadata: { sleepHours: 5 } },
    { id: 'rg2', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: daysAgo(10), source: 'observed', confidence: 0.82, metadata: { sleepHours: 4.5 } },
    { id: 'rg3', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: daysAgo(9), source: 'observed', confidence: 0.79, metadata: { sleepHours: 5.5 } },
    { id: 'rg4', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: daysAgo(8), source: 'observed', confidence: 0.81, metadata: { sleepHours: 7 } },
  ];

  const result = runSyncoThinkingLayer({
    userId,
    memories,
    currentSignals: { sleepHours: 5 },
    decayOptions: { now: NOW },
  });

  ok('T19: patterns detected', result.patterns.length >= 1);
  ok('T19: pattern has decayDiagnostics (decay applied)', result.patterns[0].decayDiagnostics !== undefined);
  ok('T19: rawConfidence preserved', result.patterns[0].rawConfidence !== undefined);
  ok('T19: hypotheses generated (pattern not stale at 8-11 days)', result.hypotheses.length >= 1);
  ok('T19: low_sleep hypothesis', result.hypotheses.some(h => h.causeSignal === 'low_sleep'));
  ok('T19: prediction generated', result.predictions.length >= 1);

  const p = result.patterns[0];
  const decayFactor = p.decayDiagnostics!.decayFactor;
  ok('T19: decayFactor < 1.0 (decay occurred)', decayFactor < 1.0);
  ok('T19: decayFactor > 0.7 (recent, not heavy decay)', decayFactor > 0.7);
  info(`T19: status=${p.status} rawConf=${p.rawConfidence?.toFixed(3)} decayedConf=${p.confidence.toFixed(3)} factor=${decayFactor.toFixed(4)}`);
}

// ─── T19b: confidence clamped to [0, 1] ──────────────────────────────────────

console.log('\n── T19b: confidence always clamped to [0, 1] ────────────────────');
{
  // Extreme case: 365 days ago with tiny halfLife
  const pattern = makePattern(365, 0.99);
  const decayed = applyPatternDecay(pattern, NOW, { halfLifeDays: 1 });

  ok('T19b: confidence >= 0', decayed.confidence >= 0);
  ok('T19b: confidence <= 1', decayed.confidence <= 1);

  // Very high confidence, 0 days
  const fresh = makePattern(0, 0.9999);
  const freshDecayed = applyPatternDecay(fresh, NOW);
  ok('T19b: fresh confidence does not exceed 1', freshDecayed.confidence <= 1);
  info(`T19b: extreme decay=${decayed.confidence.toExponential(3)}, fresh=${freshDecayed.confidence.toFixed(4)}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(` Phase 6 Pattern Decay — ${passed + failed} total`);
console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
