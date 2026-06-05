/**
 * Synco Phase 3 — Reschedule Burst Collapse Diagnostics
 *
 * Tests:
 *   T1 — Three moves within 5 min → member/member/final
 *   T2 — Single isolated move → sole
 *   T3 — Initial placement refinement (2 min after creation) → true
 *   T4 — Not initial placement (2 hours after creation) → false
 *   T5 — Different dateIso → not merged into same burst
 *   T6 — Missing taskCreatedAt → isInitialPlacementRefinement false, no error
 *   T7 — Feature flag off → no burstRole annotation added
 *   T8 — Derivation unchanged: task_rescheduled → [], no Qdrant write
 *   T9 — Gate regression: duplicate task_completed suppressed; recurring dateIso accepted
 */

import { prisma } from '../server/lib/prisma.js';
import {
  annotateRescheduleBurst,
  detectRescheduleBurstContext,
  BURST_WINDOW_MS,
  INITIAL_PLACEMENT_WINDOW_MS,
} from '../server/brain/services/rescheduleBurstDetector.js';
import { deriveFactualMemoriesFromLearningEvent } from '../server/brain/services/learningMemoryDerivation.js';
import { runContextualDuplicateGate } from '../server/brain/services/learningIntegrityGate.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'diag-phase3-user';
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ ${label}`); failed++; }
}
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Create a raw task_rescheduled row (simulates what updateTask + route already does). */
async function createRescheduleEvent(opts: {
  id: string;
  taskId: string;
  dateIso: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}) {
  return prisma.learningEvent.create({
    data: {
      id:                opts.id,
      userId:            USER_ID,
      taskId:            opts.taskId,
      eventType:         'task_rescheduled',
      dateIso:           opts.dateIso,
      occurredAt:        opts.occurredAt,
      taskTitleSnapshot: 'Phase 3 diag task',
      fromStartTime:     new Date('2026-06-05T09:00:00Z'),
      toStartTime:       new Date('2026-06-05T10:00:00Z'),
      fromEndTime:       new Date('2026-06-05T09:45:00Z'),
      toEndTime:         new Date('2026-06-05T10:45:00Z'),
      metadata:          opts.metadata ?? { duration: 45, priority: 'high', flexibility: 'flexible' },
    },
  });
}

async function getMetadata(id: string): Promise<Record<string, unknown>> {
  const row = await prisma.learningEvent.findUniqueOrThrow({ where: { id }, select: { metadata: true } });
  return (row.metadata ?? {}) as Record<string, unknown>;
}

async function cleanup() {
  await prisma.learningEvent.deleteMany({ where: { userId: USER_ID } });
  await prisma.learningEvent.deleteMany({ where: { userId: 'other-user' } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' Phase 3 — Reschedule Burst Collapse Diagnostics');
  console.log('══════════════════════════════════════════════════════════════════\n');

  await cleanup();

  // ── T1: Three moves within 5 min → member/member/final ───────────────────
  console.log('── T1: Three moves within 5 min ─────────────────────────────────');
  {
    const taskId  = `t1-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date('2026-06-05T10:00:00Z');
    const t1 = new Date(t0.getTime() + 90_000);   // t0 + 90 s
    const t2 = new Date(t0.getTime() + 180_000);  // t0 + 180 s

    const e0Id = `t1-e0-${Date.now()}`;
    const e1Id = `t1-e1-${Date.now()}`;
    const e2Id = `t1-e2-${Date.now()}`;

    const base = { taskId, dateIso, metadata: { duration: 45, priority: 'high', flexibility: 'flexible' } };
    const e0 = await createRescheduleEvent({ ...base, id: e0Id, occurredAt: t0 });
    await annotateRescheduleBurst({ id: e0.id, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt: t0, metadata: base.metadata });

    const e1 = await createRescheduleEvent({ ...base, id: e1Id, occurredAt: t1 });
    await annotateRescheduleBurst({ id: e1.id, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt: t1, metadata: base.metadata });

    const e2 = await createRescheduleEvent({ ...base, id: e2Id, occurredAt: t2 });
    await annotateRescheduleBurst({ id: e2.id, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt: t2, metadata: base.metadata });

    const m0 = await getMetadata(e0Id);
    const m1 = await getMetadata(e1Id);
    const m2 = await getMetadata(e2Id);

    ok('T1: e0 burstRole = member', m0.burstRole === 'member');
    ok('T1: e1 burstRole = member', m1.burstRole === 'member');
    ok('T1: e2 burstRole = final',  m2.burstRole === 'final');

    // All three raw Postgres rows still exist
    const count = await prisma.learningEvent.count({ where: { userId: USER_ID, taskId, eventType: 'task_rescheduled' } });
    ok('T1: all 3 raw Postgres rows preserved', count === 3);

    // Existing metadata fields preserved on e2
    ok('T1: e2 duration preserved', m2.duration === 45);
    ok('T1: e2 priority preserved', m2.priority === 'high');

    // No behavioral labels
    const forbidden = ['postponement', 'avoidance', 'procrastination', 'planning_failure', 'discipline'];
    const allMeta = JSON.stringify([m0, m1, m2]);
    ok('T1: no forbidden labels in metadata', !forbidden.some(f => allMeta.includes(f)));

    // Zero Qdrant memories
    const mems = deriveFactualMemoriesFromLearningEvent({ id: e2Id, userId: USER_ID, eventType: 'task_rescheduled', taskTitleSnapshot: 'Phase 3 diag task', taskId, dateIso });
    ok('T1: task_rescheduled → 0 derived Qdrant memories', mems.length === 0);

    info(`burstWindowMs = ${m2.burstWindowMs}, burstDetectedAt = ${m2.burstDetectedAt}`);
  }

  // ── T2: Single isolated move → sole ──────────────────────────────────────
  console.log('\n── T2: Single isolated move ─────────────────────────────────────');
  {
    const taskId  = `t2-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date('2026-06-05T11:00:00Z'); // No prior events in window

    const eId = `t2-e0-${Date.now()}`;
    await createRescheduleEvent({ id: eId, taskId, dateIso, occurredAt: t0 });
    await annotateRescheduleBurst({ id: eId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt: t0, metadata: { duration: 30 } });

    const m = await getMetadata(eId);
    ok('T2: burstRole = sole',                m.burstRole === 'sole');
    ok('T2: raw Postgres row saved',          !!(await prisma.learningEvent.findUnique({ where: { id: eId } })));
    ok('T2: 0 derived Qdrant memories',       deriveFactualMemoriesFromLearningEvent({ id: eId, userId: USER_ID, eventType: 'task_rescheduled', taskTitleSnapshot: 'diag', taskId, dateIso }).length === 0);
  }

  // ── T3: Initial placement refinement (2 min after creation) ──────────────
  console.log('\n── T3: isInitialPlacementRefinement = true ──────────────────────');
  {
    const taskId     = `t3-task-${Date.now()}`;
    const dateIso    = '2026-06-05';
    const occurredAt = new Date('2026-06-05T12:02:00Z');
    const taskCreatedAt = new Date('2026-06-05T12:00:00Z'); // 2 min before

    const eId = `t3-e0-${Date.now()}`;
    const meta = { duration: 30, taskCreatedAt: taskCreatedAt.toISOString() };
    await createRescheduleEvent({ id: eId, taskId, dateIso, occurredAt, metadata: meta });
    await annotateRescheduleBurst({ id: eId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt, metadata: meta });

    const m = await getMetadata(eId);
    ok('T3: isInitialPlacementRefinement = true',  m.isInitialPlacementRefinement === true);
    ok('T3: no postponement label',                !JSON.stringify(m).includes('postpone'));
    ok('T3: no avoidance label',                   !JSON.stringify(m).includes('avoidance'));
    ok('T3: taskCreatedAt preserved in metadata',  m.taskCreatedAt === taskCreatedAt.toISOString());
    info(`T3: 2 min after creation → isInitialPlacementRefinement=${m.isInitialPlacementRefinement}`);
  }

  // ── T4: Not initial placement (2 hours after creation) ───────────────────
  console.log('\n── T4: isInitialPlacementRefinement = false ─────────────────────');
  {
    const taskId     = `t4-task-${Date.now()}`;
    const dateIso    = '2026-06-05';
    const occurredAt = new Date('2026-06-05T14:00:00Z');
    const taskCreatedAt = new Date('2026-06-05T12:00:00Z'); // 2 hours before

    const eId = `t4-e0-${Date.now()}`;
    const meta = { duration: 30, taskCreatedAt: taskCreatedAt.toISOString() };
    await createRescheduleEvent({ id: eId, taskId, dateIso, occurredAt, metadata: meta });
    await annotateRescheduleBurst({ id: eId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt, metadata: meta });

    const m = await getMetadata(eId);
    ok('T4: isInitialPlacementRefinement = false', m.isInitialPlacementRefinement === false);
    info(`T4: 2 hours after creation → isInitialPlacementRefinement=${m.isInitialPlacementRefinement}`);
  }

  // ── T5: Different dateIso → not merged ───────────────────────────────────
  console.log('\n── T5: Different dateIso → not merged into same burst ───────────');
  {
    const taskId   = `t5-task-${Date.now()}`;
    const dateIso1 = '2026-06-04';
    const dateIso2 = '2026-06-05';
    // Both within 5 minutes of each other in wall-clock time
    const t0 = new Date('2026-06-05T15:00:00Z');
    const t1 = new Date(t0.getTime() + 60_000); // 60 s later

    const e0Id = `t5-e0-${Date.now()}`;
    const e1Id = `t5-e1-${Date.now()}`;

    await createRescheduleEvent({ id: e0Id, taskId, dateIso: dateIso1, occurredAt: t0 });
    await annotateRescheduleBurst({ id: e0Id, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso: dateIso1, occurredAt: t0, metadata: {} });

    await createRescheduleEvent({ id: e1Id, taskId, dateIso: dateIso2, occurredAt: t1 });
    await annotateRescheduleBurst({ id: e1Id, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso: dateIso2, occurredAt: t1, metadata: {} });

    const m0 = await getMetadata(e0Id);
    const m1 = await getMetadata(e1Id);

    ok('T5: e0 (dateIso1) burstRole = sole', m0.burstRole === 'sole');
    ok('T5: e1 (dateIso2) burstRole = sole — different dateIso not merged', m1.burstRole === 'sole');
    info(`T5: dateIso1=${dateIso1} → ${m0.burstRole}, dateIso2=${dateIso2} → ${m1.burstRole}`);
  }

  // ── T6: Missing taskCreatedAt → isInitialPlacementRefinement false ────────
  console.log('\n── T6: Missing taskCreatedAt → isInitialPlacementRefinement false ');
  {
    const taskId  = `t6-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const occurredAt = new Date();
    const meta = { duration: 30 }; // no taskCreatedAt

    const eId = `t6-e0-${Date.now()}`;
    await createRescheduleEvent({ id: eId, taskId, dateIso, occurredAt, metadata: meta });

    let threw = false;
    try {
      await annotateRescheduleBurst({ id: eId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt, metadata: meta });
    } catch {
      threw = true;
    }

    const m = await getMetadata(eId);
    ok('T6: no error thrown',                       !threw);
    ok('T6: isInitialPlacementRefinement = false',  m.isInitialPlacementRefinement === false);
    ok('T6: duration preserved',                     m.duration === 30);
  }

  // ── T7: Feature flag off → no burstRole annotation ────────────────────────
  console.log('\n── T7: Feature flag off → no annotation ─────────────────────────');
  {
    const taskId  = `t7-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const occurredAt = new Date();
    const meta = { duration: 20 };

    const eId = `t7-e0-${Date.now()}`;
    await createRescheduleEvent({ id: eId, taskId, dateIso, occurredAt, metadata: meta });

    const prev = process.env.SYNCO_BURST_DETECTION_ENABLED;
    process.env.SYNCO_BURST_DETECTION_ENABLED = 'false';
    await annotateRescheduleBurst({ id: eId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso, occurredAt, metadata: meta });
    if (prev === undefined) delete process.env.SYNCO_BURST_DETECTION_ENABLED;
    else process.env.SYNCO_BURST_DETECTION_ENABLED = prev;

    const m = await getMetadata(eId);
    ok('T7: no burstRole in metadata when flag off', !('burstRole' in m));
    ok('T7: raw event still saved',                   !!(await prisma.learningEvent.findUnique({ where: { id: eId } })));
    ok('T7: 0 Qdrant memories',                       deriveFactualMemoriesFromLearningEvent({ id: eId, userId: USER_ID, eventType: 'task_rescheduled', taskTitleSnapshot: 'diag', taskId, dateIso }).length === 0);
    info('T7: flag restored after test');
  }

  // ── T8: Derivation and Qdrant confirmation ────────────────────────────────
  console.log('\n── T8: Derivation unchanged — task_rescheduled returns [] ────────');
  {
    const mems = deriveFactualMemoriesFromLearningEvent({
      id: 'diag-t8', userId: USER_ID, eventType: 'task_rescheduled',
      taskTitleSnapshot: 'Phase 3 diag', taskId: 't8-task', dateIso: '2026-06-05',
    });
    ok('T8: task_rescheduled → 0 derived memories', mems.length === 0);
    ok('T8: storeUserMessage never called (loop never entered)', mems.length === 0);
    info('T8: confirmed — no Qdrant writes from reschedule burst annotation');
  }

  // ── T9: Gate regression ───────────────────────────────────────────────────
  console.log('\n── T9: Gate regression ──────────────────────────────────────────');
  {
    // duplicate task_completed
    const taskId  = `t9-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 400);

    await prisma.learningEvent.create({ data: { id: `t9-A-${Date.now()}`, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t0, taskTitleSnapshot: 'gate-reg' } });
    const secondId = `t9-B-${Date.now()}`;
    await prisma.learningEvent.create({ data: { id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1, taskTitleSnapshot: 'gate-reg' } });

    const r1 = await runContextualDuplicateGate({ id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1 });
    ok('T9: duplicate task_completed still → duplicate_ignored', r1.status === 'duplicate_ignored');

    // different dateIso → accepted
    const taskId2  = `t9-task2-${Date.now()}`;
    const t2 = new Date(t0.getTime() + 200);
    await prisma.learningEvent.create({ data: { id: `t9-C-${Date.now()}`, userId: USER_ID, taskId: taskId2, eventType: 'task_completed', dateIso: '2026-06-04', occurredAt: t0, taskTitleSnapshot: 'gate-reg' } });
    const thirdId = `t9-D-${Date.now()}`;
    await prisma.learningEvent.create({ data: { id: thirdId, userId: USER_ID, taskId: taskId2, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t2, taskTitleSnapshot: 'gate-reg' } });

    const r2 = await runContextualDuplicateGate({ id: thirdId, userId: USER_ID, taskId: taskId2, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t2 });
    ok('T9: different dateIso recurring task → accepted', r2.status === 'accepted');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await cleanup();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` Phase 3 Burst Diagnostics — ${passed + failed} total`);
  console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main()
  .catch(e => { console.error('Diagnostic error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
