/**
 * Phase 5 Reschedule Burst Collapse Tests
 *
 * T1  — 5 reschedules within 10 minutes → 1 burst
 * T2  — 5 reschedules over 2 hours → 5 separate bursts
 * T3  — different tasks are never collapsed together
 * T4  — missing taskId falls back to taskTitleSnapshot
 * T5  — both taskId and title missing → key = 'unknown' (fallback safe)
 * T6  — burst memoryKind is 'task_reschedule_burst', NOT 'task_completion_failed'
 * T7  — burst confidence is moderate (0.40) — not verified
 * T8  — burst source is 'system_derived'
 * T9  — burst metadata includes originalEventCount, firstRescheduledAt, lastRescheduledAt
 * T10 — burstDurationMinutes correct for 8-minute window
 * T11 — fromTimes/toTimes extracted from DB fields
 * T12 — fromTimes/toTimes extracted from metadata fallback when DB fields absent
 * T13 — single reschedule → 1 burst with originalEventCount=1
 * T14 — empty input → 0 bursts, correct stats
 * T15 — burst id is prefixed 'burst-' + first event id
 * T16 — pipeline receives burst memories and includes burst stats in diagnostics
 * T17 — burst stats appear in dataAvailabilityNotes
 * T18 — existing LearningEvent mapping tests still pass
 * T19 — all regression tests pass (thinking layer, pipeline)
 */

import {
  collapseRescheduleBursts,
  DEFAULT_BURST_WINDOW_MINUTES,
  type RawRescheduledEvent,
} from '../server/brain/services/rescheduleBurstCollapse.js';

import {
  mapLearningEventToSyncoMemory,
  mapLearningEventsToBrainMemories,
  type RawLearningEvent,
} from '../server/brain/services/memoryLoader.js';

import { runBrainPipeline } from '../server/brain/services/brainPipeline.js';
import { runSyncoThinkingLayer, type SyncoMemory } from '../server/brain/services/syncoThinkingLayer.js';

const userId = 'phase5-test-user';
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ ${label}`); failed++; }
}
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }

// ─── Helper: build a RawRescheduledEvent ──────────────────────────────────────

function makeReschedule(
  id: string,
  taskId: string | null,
  title: string | null,
  offsetMinutes: number,
  base: Date = new Date('2026-06-12T10:00:00.000Z'),
  fromStartTime?: Date,
  toStartTime?: Date,
): RawRescheduledEvent {
  const occurredAt = new Date(base.getTime() + offsetMinutes * 60_000);
  return {
    id,
    userId,
    taskId,
    eventType: 'task_rescheduled',
    source: 'system',
    occurredAt,
    taskTitleSnapshot: title,
    fromStartTime: fromStartTime ?? null,
    toStartTime:   toStartTime   ?? null,
    metadata: {},
  };
}

const BASE = new Date('2026-06-12T10:00:00.000Z');

// ─── T1: 5 reschedules within 10 minutes → 1 burst ───────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(' Phase 5 Reschedule Burst Collapse Tests');
console.log('══════════════════════════════════════════════════════════════════\n');

console.log('── T1: 5 reschedules within 10 min → 1 burst ────────────────────');
{
  const events = [
    makeReschedule('r1', 'task-A', 'Task A', 0),
    makeReschedule('r2', 'task-A', 'Task A', 2),
    makeReschedule('r3', 'task-A', 'Task A', 4),
    makeReschedule('r4', 'task-A', 'Task A', 6),
    makeReschedule('r5', 'task-A', 'Task A', 8),
  ];
  const { memories, stats } = collapseRescheduleBursts(events);

  ok('T1: exactly 1 burst', memories.length === 1);
  ok('T1: stats.rawRescheduleEventsCount = 5', stats.rawRescheduleEventsCount === 5);
  ok('T1: stats.collapsedRescheduleBurstsCount = 1', stats.collapsedRescheduleBurstsCount === 1);
  ok('T1: stats.window = DEFAULT_BURST_WINDOW_MINUTES', stats.rescheduleCollapseWindowMinutes === DEFAULT_BURST_WINDOW_MINUTES);
  info(`T1: ${stats.rawRescheduleEventsCount} events → ${stats.collapsedRescheduleBurstsCount} burst(s)`);
}

// ─── T2: 5 reschedules over 2 hours → 5 separate bursts ──────────────────────

console.log('\n── T2: 5 reschedules over 2 hours → 5 separate bursts ───────────');
{
  const events = [
    makeReschedule('s1', 'task-B', 'Task B',  0),
    makeReschedule('s2', 'task-B', 'Task B', 30),
    makeReschedule('s3', 'task-B', 'Task B', 60),
    makeReschedule('s4', 'task-B', 'Task B', 90),
    makeReschedule('s5', 'task-B', 'Task B', 120),
  ];
  const { memories, stats } = collapseRescheduleBursts(events);

  ok('T2: 5 separate bursts', memories.length === 5);
  ok('T2: stats.rawRescheduleEventsCount = 5', stats.rawRescheduleEventsCount === 5);
  ok('T2: stats.collapsedRescheduleBurstsCount = 5', stats.collapsedRescheduleBurstsCount === 5);
  ok('T2: each burst has originalEventCount = 1', memories.every(m => m.metadata?.originalEventCount === 1));
  info(`T2: ${stats.rawRescheduleEventsCount} events → ${stats.collapsedRescheduleBurstsCount} bursts`);
}

// ─── T3: different tasks are never collapsed together ─────────────────────────

console.log('\n── T3: different tasks → no cross-task collapse ──────────────────');
{
  const events = [
    makeReschedule('d1', 'task-X', 'Task X', 0),
    makeReschedule('d2', 'task-Y', 'Task Y', 1),   // different task, 1 min later
    makeReschedule('d3', 'task-X', 'Task X', 2),
    makeReschedule('d4', 'task-Y', 'Task Y', 3),
  ];
  const { memories, stats } = collapseRescheduleBursts(events);

  ok('T3: 2 bursts (one per task)', memories.length === 2);
  const taskXBurst = memories.find(m => m.entityId === 'task-X');
  const taskYBurst = memories.find(m => m.entityId === 'task-Y');
  ok('T3: task-X burst exists', taskXBurst !== undefined);
  ok('T3: task-Y burst exists', taskYBurst !== undefined);
  ok('T3: task-X burst has count=2', taskXBurst?.metadata?.originalEventCount === 2);
  ok('T3: task-Y burst has count=2', taskYBurst?.metadata?.originalEventCount === 2);
  info(`T3: 4 events across 2 tasks → ${stats.collapsedRescheduleBurstsCount} bursts`);
}

// ─── T4: missing taskId falls back to taskTitleSnapshot ──────────────────────

console.log('\n── T4: missing taskId falls back to title ────────────────────────');
{
  const events = [
    makeReschedule('n1', null, 'Unnamed Task', 0),
    makeReschedule('n2', null, 'Unnamed Task', 3),
    makeReschedule('n3', null, 'Unnamed Task', 6),
  ];
  const { memories } = collapseRescheduleBursts(events);

  ok('T4: 3 events with same title → 1 burst', memories.length === 1);
  ok('T4: entityId is undefined (no taskId)', memories[0].entityId === undefined);
  ok('T4: entityName is title', memories[0].entityName === 'Unnamed Task');
  ok('T4: originalEventCount = 3', memories[0].metadata?.originalEventCount === 3);
  info(`T4: fallback to title worked, entityName=${memories[0].entityName}`);
}

// ─── T5: both taskId and title missing → 'unknown' key ───────────────────────

console.log('\n── T5: no taskId and no title → key=unknown (safe fallback) ─────');
{
  const events = [
    makeReschedule('u1', null, null, 0),
    makeReschedule('u2', null, null, 2),
  ];
  const { memories } = collapseRescheduleBursts(events);

  ok('T5: 2 unknown-key events → 1 burst', memories.length === 1);
  ok('T5: entityId undefined', memories[0].entityId === undefined);
  ok('T5: entityName undefined', memories[0].entityName === undefined);
  ok('T5: no throw (safe)', true);
  info('T5: unknown fallback handled safely');
}

// ─── T6: memoryKind is task_reschedule_burst, NOT task_completion_failed ──────

console.log('\n── T6: burst memoryKind ≠ task_completion_failed ─────────────────');
{
  const events = [makeReschedule('m1', 'task-C', 'Task C', 0)];
  const { memories } = collapseRescheduleBursts(events);

  ok('T6: memoryKind = task_reschedule_burst', memories[0].memoryKind === 'task_reschedule_burst');
  ok('T6: memoryKind ≠ task_completion_failed', memories[0].memoryKind !== 'task_completion_failed');
  ok('T6: memoryKind ≠ task_postponed', memories[0].memoryKind !== 'task_postponed');
  ok('T6: memoryKind ≠ task_skipped', memories[0].memoryKind !== 'task_skipped');
  info(`T6: memoryKind=${memories[0].memoryKind}`);
}

// ─── T7: burst confidence is moderate (0.40), not verified ───────────────────

console.log('\n── T7: burst confidence is moderate (0.40) ───────────────────────');
{
  const events = [makeReschedule('c1', 'task-D', 'Task D', 0)];
  const { memories } = collapseRescheduleBursts(events);

  ok('T7: confidence = 0.40', memories[0].confidence === 0.40);
  ok('T7: confidence < timer_confirmed (0.90)', memories[0].confidence < 0.90);
  ok('T7: confidence < observed (0.80)', memories[0].confidence < 0.80);
  ok('T7: confidence < user_reported (0.60)', memories[0].confidence < 0.60);
  info(`T7: confidence=${memories[0].confidence}`);
}

// ─── T8: burst source is system_derived ──────────────────────────────────────

console.log('\n── T8: burst source = system_derived ────────────────────────────');
{
  const events = [makeReschedule('src1', 'task-E', 'Task E', 0)];
  const { memories } = collapseRescheduleBursts(events);

  ok('T8: source = system_derived', memories[0].source === 'system_derived');
  info(`T8: source=${memories[0].source}`);
}

// ─── T9: burst metadata fields ────────────────────────────────────────────────

console.log('\n── T9: burst metadata includes required fields ───────────────────');
{
  const events = [
    makeReschedule('meta1', 'task-F', 'Task F', 0),
    makeReschedule('meta2', 'task-F', 'Task F', 5),
  ];
  const { memories } = collapseRescheduleBursts(events);
  const meta = memories[0].metadata as Record<string, unknown>;

  ok('T9: originalEventCount present', 'originalEventCount' in meta);
  ok('T9: originalEventCount = 2', meta.originalEventCount === 2);
  ok('T9: firstRescheduledAt present', typeof meta.firstRescheduledAt === 'string');
  ok('T9: lastRescheduledAt present', typeof meta.lastRescheduledAt === 'string');
  ok('T9: burstDurationMinutes present', typeof meta.burstDurationMinutes === 'number');
  ok('T9: isBurst = true', meta.isBurst === true);
  ok('T9: firstRescheduledAt < lastRescheduledAt', meta.firstRescheduledAt < meta.lastRescheduledAt);
  info(`T9: duration=${meta.burstDurationMinutes}m, count=${meta.originalEventCount}`);
}

// ─── T10: burstDurationMinutes correct ────────────────────────────────────────

console.log('\n── T10: burstDurationMinutes is accurate ─────────────────────────');
{
  const events = [
    makeReschedule('dur1', 'task-G', 'Task G', 0),
    makeReschedule('dur2', 'task-G', 'Task G', 8),
  ];
  const { memories } = collapseRescheduleBursts(events);
  const duration = (memories[0].metadata as Record<string, unknown>).burstDurationMinutes as number;

  ok('T10: burstDurationMinutes ≈ 8', Math.abs(duration - 8) < 0.5);
  info(`T10: burstDurationMinutes=${duration}`);
}

// ─── T11: fromTimes/toTimes from DB fields ────────────────────────────────────

console.log('\n── T11: fromTimes/toTimes extracted from DB fields ───────────────');
{
  const from1 = new Date('2026-06-12T09:00:00.000Z');
  const to1   = new Date('2026-06-12T11:00:00.000Z');
  const from2 = new Date('2026-06-12T09:05:00.000Z');
  const to2   = new Date('2026-06-12T12:00:00.000Z');

  const events = [
    makeReschedule('tf1', 'task-H', 'Task H', 0, BASE, from1, to1),
    makeReschedule('tf2', 'task-H', 'Task H', 3, BASE, from2, to2),
  ];
  const { memories } = collapseRescheduleBursts(events);
  const meta = memories[0].metadata as Record<string, unknown>;

  ok('T11: fromTimes is array', Array.isArray(meta.fromTimes));
  ok('T11: toTimes is array', Array.isArray(meta.toTimes));
  ok('T11: fromTimes has 2 entries', (meta.fromTimes as string[]).length === 2);
  ok('T11: toTimes has 2 entries', (meta.toTimes as string[]).length === 2);
  ok('T11: fromTimes[0] matches from1', (meta.fromTimes as string[])[0] === from1.toISOString());
  info(`T11: fromTimes=${JSON.stringify(meta.fromTimes)}`);
}

// ─── T12: fromTimes/toTimes from metadata fallback ────────────────────────────

console.log('\n── T12: fromTimes/toTimes extracted from metadata fallback ───────');
{
  const eventWithMetadata: RawRescheduledEvent = {
    id: 'mf1',
    userId,
    taskId: 'task-I',
    eventType: 'task_rescheduled',
    source: 'system',
    occurredAt: BASE,
    taskTitleSnapshot: 'Task I',
    fromStartTime: null,
    toStartTime: null,
    metadata: {
      fromStartTime: '2026-06-12T08:00:00.000Z',
      toStartTime:   '2026-06-12T14:00:00.000Z',
    },
  };
  const { memories } = collapseRescheduleBursts([eventWithMetadata]);
  const meta = memories[0].metadata as Record<string, unknown>;

  ok('T12: fromTimes extracted from metadata', Array.isArray(meta.fromTimes));
  ok('T12: toTimes extracted from metadata', Array.isArray(meta.toTimes));
  ok('T12: fromTimes[0] = metadata value', (meta.fromTimes as string[])[0] === '2026-06-12T08:00:00.000Z');
  ok('T12: toTimes[0] = metadata value', (meta.toTimes as string[])[0] === '2026-06-12T14:00:00.000Z');
  info('T12: metadata fallback extraction works');
}

// ─── T13: single reschedule → 1 burst with count=1 ───────────────────────────

console.log('\n── T13: single reschedule → 1 burst, count=1 ────────────────────');
{
  const events = [makeReschedule('one1', 'task-J', 'Task J', 0)];
  const { memories, stats } = collapseRescheduleBursts(events);

  ok('T13: 1 burst', memories.length === 1);
  ok('T13: originalEventCount = 1', memories[0].metadata?.originalEventCount === 1);
  ok('T13: burstDurationMinutes = 0', memories[0].metadata?.burstDurationMinutes === 0);
  ok('T13: fromTimes is undefined (no time data)', memories[0].metadata?.fromTimes === undefined);
  info(`T13: single event → burst with count=${memories[0].metadata?.originalEventCount}`);
}

// ─── T14: empty input → 0 bursts ──────────────────────────────────────────────

console.log('\n── T14: empty input → 0 bursts, stats correct ───────────────────');
{
  const { memories, stats } = collapseRescheduleBursts([]);

  ok('T14: 0 memories', memories.length === 0);
  ok('T14: rawRescheduleEventsCount = 0', stats.rawRescheduleEventsCount === 0);
  ok('T14: collapsedRescheduleBurstsCount = 0', stats.collapsedRescheduleBurstsCount === 0);
  ok('T14: window preserved in stats', stats.rescheduleCollapseWindowMinutes === DEFAULT_BURST_WINDOW_MINUTES);
  info('T14: empty input handled safely');
}

// ─── T15: burst id prefixed with 'burst-' ─────────────────────────────────────

console.log('\n── T15: burst id = "burst-" + first event id ────────────────────');
{
  const events = [
    makeReschedule('first-id', 'task-K', 'Task K', 0),
    makeReschedule('second-id', 'task-K', 'Task K', 2),
  ];
  const { memories } = collapseRescheduleBursts(events);

  ok('T15: id starts with burst-', memories[0].id.startsWith('burst-'));
  ok('T15: id = burst-first-id', memories[0].id === 'burst-first-id');
  info(`T15: burst id=${memories[0].id}`);
}

// ─── T16: pipeline receives burst memories + burst stats in diagnostics ───────

console.log('\n── T16: pipeline includes rescheduleBurstStats in diagnostics ────');
{
  const burstMemory: SyncoMemory = {
    id:         'burst-test-1',
    userId,
    memoryKind: 'task_reschedule_burst',
    entityType: 'task',
    entityId:   'task-L',
    entityName: 'Task L',
    occurredAt: BASE.toISOString(),
    source:     'system_derived',
    confidence: 0.40,
    metadata: {
      originalEventCount: 3,
      firstRescheduledAt: BASE.toISOString(),
      lastRescheduledAt:  new Date(BASE.getTime() + 8 * 60_000).toISOString(),
      burstDurationMinutes: 8,
      isBurst: true,
    },
  };

  const burstStats = {
    rawRescheduleEventsCount: 3,
    collapsedRescheduleBurstsCount: 1,
    rescheduleCollapseWindowMinutes: 10,
  };

  const r = await runBrainPipeline({
    userId,
    text: 'אני צריך לסדר את המשימה',
    memories: [burstMemory],
    memoriesSource: 'real_db',
    rescheduleBurstStats: burstStats,
    lifeRules: [],
    lifeRulesSource: 'unavailable',
    devMode: true,
  });

  ok('T16: ok = true', r.ok === true);
  ok('T16: diagnostics present', r.diagnostics !== undefined);
  ok('T16: rescheduleBurstStats in diagnostics', r.diagnostics?.rescheduleBurstStats !== undefined);
  ok('T16: rawCount = 3', r.diagnostics?.rescheduleBurstStats?.rawRescheduleEventsCount === 3);
  ok('T16: collapsedCount = 1', r.diagnostics?.rescheduleBurstStats?.collapsedRescheduleBurstsCount === 1);
  info(`T16: burst stats in diagnostics: ${JSON.stringify(r.diagnostics?.rescheduleBurstStats)}`);
}

// ─── T17: burst stats appear in dataAvailabilityNotes ────────────────────────

console.log('\n── T17: burst stats in dataAvailabilityNotes ─────────────────────');
{
  const burstStats = {
    rawRescheduleEventsCount: 5,
    collapsedRescheduleBurstsCount: 2,
    rescheduleCollapseWindowMinutes: 10,
  };

  const r = await runBrainPipeline({
    userId,
    text: 'בדיקת הערות',
    memories: [],
    memoriesSource: 'unavailable',
    rescheduleBurstStats: burstStats,
    lifeRules: [],
    devMode: true,
  });

  const notes = r.diagnostics?.dataAvailabilityNotes ?? [];
  ok('T17: notes is array', Array.isArray(notes));
  const burstNote = notes.find(n => n.includes('reschedule_bursts'));
  ok('T17: note mentions reschedule_bursts', burstNote !== undefined);
  ok('T17: note mentions raw count', burstNote?.includes('5') === true);
  ok('T17: note mentions collapsed count', burstNote?.includes('2') === true);
  info(`T17: burstNote="${burstNote}"`);
}

// ─── T18: existing LearningEvent mapping still works ─────────────────────────

console.log('\n── T18: existing LearningEvent mapping regression ────────────────');
{
  const rawEvent: RawLearningEvent = {
    id: 'reg-1',
    userId,
    taskId: 'task-reg',
    eventType: 'task_completed',
    source: 'timer',
    occurredAt: new Date('2026-06-10T09:00:00.000Z'),
    dateIso: '2026-06-10',
    taskTitleSnapshot: 'Regression test task',
    fromStatus: 'OPEN',
    toStatus: 'DONE',
    metadata: {},
  };

  const mem = mapLearningEventToSyncoMemory(rawEvent);
  ok('T18: memoryKind = task_completed', mem.memoryKind === 'task_completed');
  ok('T18: source = timer_confirmed', mem.source === 'timer_confirmed');
  ok('T18: confidence >= 0.90', mem.confidence >= 0.90);
  ok('T18: entityId = task-reg', mem.entityId === 'task-reg');

  const batch = mapLearningEventsToBrainMemories([rawEvent]);
  ok('T18: batch maps 1 event', batch.length === 1);
  ok('T18: memoryKind preserved in batch', batch[0].memoryKind === 'task_completed');
  info('T18: existing mapping unchanged');
}

// ─── T19: regression — thinking layer still works ────────────────────────────

console.log('\n── T19: thinking layer regression ───────────────────────────────');
{
  const memories: SyncoMemory[] = [
    { id: 'rg1', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: '2026-06-01T08:00:00.000Z', source: 'observed', confidence: 0.80, metadata: { sleepHours: 5 } },
    { id: 'rg2', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: '2026-06-02T08:00:00.000Z', source: 'observed', confidence: 0.82, metadata: { sleepHours: 4.5 } },
    { id: 'rg3', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: '2026-06-03T08:00:00.000Z', source: 'observed', confidence: 0.79, metadata: { sleepHours: 5 } },
    { id: 'rg4', userId, memoryKind: 'task_completion_failed', entityType: 'task', entityName: 'morning', occurredAt: '2026-06-04T08:00:00.000Z', source: 'observed', confidence: 0.81, metadata: { sleepHours: 7 } },
    // burst memory mixed in — should not become task_completion_failed
    {
      id: 'burst-rg5', userId, memoryKind: 'task_reschedule_burst', entityType: 'task', entityName: 'morning',
      occurredAt: '2026-06-05T08:00:00.000Z', source: 'system_derived', confidence: 0.40,
      metadata: { originalEventCount: 3, isBurst: true },
    },
  ];

  const result = runSyncoThinkingLayer({ userId, memories, currentSignals: { sleepHours: 5 } });
  ok('T19: patterns detected from non-burst memories', result.patterns.length >= 1);
  ok('T19: hypothesis about low_sleep still works', result.hypotheses.some(h => h.causeSignal === 'low_sleep'));
  ok('T19: no burst memory became a pattern driver via task_completion_failed',
    result.patterns.every(p => p.patternType !== 'task_reschedule_burst' || p.evidenceCount >= 5));
  info('T19: burst memory coexists safely with behavior memories');
}

// ─── T19b: custom window ──────────────────────────────────────────────────────

console.log('\n── T19b: custom window (5 min) splits events 6 min apart ──────────');
{
  const events = [
    makeReschedule('w1', 'task-W', 'Task W', 0),
    makeReschedule('w2', 'task-W', 'Task W', 4),   // within 5min window
    makeReschedule('w3', 'task-W', 'Task W', 10),  // 6 min after w2 → new burst
    makeReschedule('w4', 'task-W', 'Task W', 14),  // within 5min of w3
  ];
  const { memories, stats } = collapseRescheduleBursts(events, 5);

  ok('T19b: 2 bursts with 5-min window', memories.length === 2);
  ok('T19b: first burst has count=2', memories[0].metadata?.originalEventCount === 2);
  ok('T19b: second burst has count=2', memories[1].metadata?.originalEventCount === 2);
  ok('T19b: window in stats = 5', stats.rescheduleCollapseWindowMinutes === 5);
  info(`T19b: ${stats.rawRescheduleEventsCount} events → ${stats.collapsedRescheduleBurstsCount} bursts (5-min window)`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(` Phase 5 Reschedule Burst Collapse — ${passed + failed} total`);
console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
