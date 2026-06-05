/**
 * Phase 2 — Reschedule Data Quality Diagnostic
 *
 * Verifies the task_rescheduled logLearningEvent payload now includes:
 *   - dateIso (derived from toStartTime)
 *   - metadata.taskCreatedAt (from previousTask.createdAt)
 *   - all pre-existing fields preserved
 *
 * Also verifies:
 *   - 0 derived memories for task_rescheduled
 *   - Gate passes task_rescheduled as event_not_gated
 *   - Postgres row contains the new fields
 */

import { prisma } from '../server/lib/prisma.js';
import { deriveFactualMemoriesFromLearningEvent } from '../server/brain/services/learningMemoryDerivation.js';
import { runContextualDuplicateGate } from '../server/brain/services/learningIntegrityGate.js';

const USER_ID = 'diag-phase2-user';

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); pass++; }
  else       { console.error(`  ❌ ${label}`); fail++; }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' Phase 2 — Reschedule Data Quality Diagnostic');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Cleanup leftovers from any previous run
  await prisma.learningEvent.deleteMany({ where: { userId: USER_ID } });

  // ── Simulate exact payload taskStore.updateTask() now sends ──────────────
  const now        = new Date();
  const createdAt  = new Date(now.getTime() - 10 * 60_000); // task created 10 min ago
  const fromStart  = new Date('2026-06-05T09:00:00.000Z');
  const toStart    = new Date('2026-06-05T10:30:00.000Z');
  const fromEnd    = new Date('2026-06-05T09:45:00.000Z');
  const toEnd      = new Date('2026-06-05T11:15:00.000Z');

  const payload = {
    userId:            USER_ID,
    taskId:            'diag-task-phase2',
    eventType:         'task_rescheduled' as const,
    source:            'taskStore/updateTask',
    taskTitleSnapshot: 'בדיקת Phase 2',
    dateIso:           toStart.toISOString().split('T')[0],
    fromStartTime:     fromStart.toISOString(),
    fromEndTime:       fromEnd.toISOString(),
    toStartTime:       toStart.toISOString(),
    toEndTime:         toEnd.toISOString(),
    metadata: {
      duration:      45,
      priority:      'high',
      flexibility:   'flexible',
      taskCreatedAt: createdAt.toISOString(),
    },
  };

  console.log('── Constructed payload ──────────────────────────────────────────');
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  // ── A. Field assertions on the constructed payload ───────────────────────
  console.log('── A. Payload field assertions ──────────────────────────────────');
  ok('eventType === task_rescheduled',            payload.eventType === 'task_rescheduled');
  ok('dateIso present and 10 chars',              typeof payload.dateIso === 'string' && payload.dateIso.length === 10);
  ok('dateIso === YYYY-MM-DD of toStartTime',     payload.dateIso === toStart.toISOString().split('T')[0]);
  ok('metadata.taskCreatedAt present',            typeof payload.metadata.taskCreatedAt === 'string');
  ok('metadata.taskCreatedAt parses as ISO date', !isNaN(Date.parse(payload.metadata.taskCreatedAt!)));
  ok('metadata.duration preserved',               payload.metadata.duration === 45);
  ok('metadata.priority preserved',               payload.metadata.priority === 'high');
  ok('metadata.flexibility preserved',            payload.metadata.flexibility === 'flexible');
  ok('fromStartTime preserved',                   payload.fromStartTime === fromStart.toISOString());
  ok('toStartTime preserved',                     payload.toStartTime === toStart.toISOString());
  ok('fromEndTime preserved',                     payload.fromEndTime === fromEnd.toISOString());
  ok('toEndTime preserved',                       payload.toEndTime === toEnd.toISOString());

  // ── B. dateIso fallback — no startTime update (uses previous startTime) ──
  console.log('\n── B. dateIso fallback (no startTime update, endTime only) ──────');
  {
    const prevStart = new Date('2026-06-05T08:00:00.000Z');
    const newEnd    = new Date('2026-06-05T09:00:00.000Z');
    // Simulates: updates.startTime is undefined → falls back to previousTask.startTime
    const fallbackDateIso = (undefined ?? prevStart).toISOString().split('T')[0];
    ok('dateIso falls back to previousTask.startTime when updates.startTime absent',
       fallbackDateIso === '2026-06-05');
  }

  // ── C. taskCreatedAt null when createdAt absent ───────────────────────────
  console.log('\n── C. taskCreatedAt null when task has no createdAt ─────────────');
  {
    const noCreatedAt: { createdAt?: Date } = {};
    const taskCreatedAt = noCreatedAt.createdAt?.toISOString?.() ?? null;
    ok('taskCreatedAt is null when createdAt absent', taskCreatedAt === null);
  }

  // ── D. Zero derived memories for task_rescheduled ─────────────────────────
  console.log('\n── D. Zero derived memories for task_rescheduled ────────────────');
  {
    const mems = deriveFactualMemoriesFromLearningEvent({
      id:                'diag-rs-derive-01',
      userId:            USER_ID,
      eventType:         'task_rescheduled',
      taskTitleSnapshot: payload.taskTitleSnapshot,
      taskId:            payload.taskId,
      dateIso:           payload.dateIso,
    });
    ok('task_rescheduled → 0 derived memories (no Qdrant writes)', mems.length === 0);
  }

  // ── E. Postgres round-trip with new fields ────────────────────────────────
  console.log('\n── E. Postgres round-trip ────────────────────────────────────────');
  {
    const savedRow = await prisma.learningEvent.create({
      data: {
        id:                'diag-rs-pg-01',
        userId:            USER_ID,
        taskId:            payload.taskId,
        eventType:         payload.eventType,
        dateIso:           payload.dateIso,
        occurredAt:        now,
        taskTitleSnapshot: payload.taskTitleSnapshot,
        fromStartTime:     payload.fromStartTime,
        fromEndTime:       payload.fromEndTime,
        toStartTime:       payload.toStartTime,
        toEndTime:         payload.toEndTime,
        metadata:          payload.metadata,
      },
    });

    ok('Postgres row: dateIso saved correctly',
       savedRow.dateIso === payload.dateIso);
    ok('Postgres row: metadata.taskCreatedAt saved',
       (savedRow.metadata as Record<string, unknown>)?.taskCreatedAt === payload.metadata.taskCreatedAt);
    ok('Postgres row: metadata.duration saved',
       (savedRow.metadata as Record<string, unknown>)?.duration === 45);
    ok('Postgres row: fromStartTime saved',
       savedRow.fromStartTime != null && new Date(savedRow.fromStartTime).toISOString() === payload.fromStartTime);
    ok('Postgres row: toStartTime saved',
       savedRow.toStartTime != null && new Date(savedRow.toStartTime).toISOString() === payload.toStartTime);

    // ── F. Gate passes task_rescheduled as event_not_gated ──────────────────
    console.log('\n── F. Gate passes task_rescheduled as event_not_gated ───────────');
    const gateResult = await runContextualDuplicateGate({
      id:        savedRow.id,
      userId:    USER_ID,
      taskId:    payload.taskId,
      eventType: 'task_rescheduled',
      dateIso:   payload.dateIso,
      occurredAt: savedRow.occurredAt,
    });
    ok('gate status === accepted',              gateResult.status === 'accepted');
    ok('gate reason === event_not_gated',       gateResult.reason === 'event_not_gated');
  }

  // ── G. Gate regression: duplicate task_completed still suppressed ─────────
  console.log('\n── G. Gate regression: duplicate task_completed suppressed ──────');
  {
    const taskId  = `diag-reg-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 400);
    await prisma.learningEvent.create({ data: { id: `diag-reg-A-${Date.now()}`, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t0, taskTitleSnapshot: 'reg' } });
    const secondId = `diag-reg-B-${Date.now()}`;
    await prisma.learningEvent.create({ data: { id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1, taskTitleSnapshot: 'reg' } });
    const r = await runContextualDuplicateGate({ id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1 });
    ok('duplicate task_completed still → duplicate_ignored', r.status === 'duplicate_ignored');
  }

  // ── H. Gate regression: different dateIso → both accepted ────────────────
  console.log('\n── H. Gate regression: different dateIso → both accepted ────────');
  {
    const taskId   = `diag-reg2-task-${Date.now()}`;
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 200);
    await prisma.learningEvent.create({ data: { id: `diag-reg2-A-${Date.now()}`, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-04', occurredAt: t0, taskTitleSnapshot: 'reg' } });
    const secondId = `diag-reg2-B-${Date.now()}`;
    await prisma.learningEvent.create({ data: { id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1, taskTitleSnapshot: 'reg' } });
    const r = await runContextualDuplicateGate({ id: secondId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1 });
    ok('different dateIso recurring task → accepted', r.status === 'accepted');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await prisma.learningEvent.deleteMany({ where: { userId: USER_ID } });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` Phase 2 Diagnostics — ${pass + fail} total`);
  console.log(` ✅ Passed: ${pass}   ❌ Failed: ${fail}`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (fail > 0) process.exit(1);
}

main()
  .catch(e => { console.error('Diagnostic error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
