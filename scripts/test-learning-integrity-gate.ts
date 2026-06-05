/**
 * Synco Learning Integrity Gate — Diagnostic Script
 *
 * Tests the contextual duplicate gate implemented in Phase 1.
 *
 * Diagnostics:
 *   A — duplicate task_completed
 *   B — duplicate task_execution_completed
 *   C — recurring task: different dateIso → both accepted
 *   D — duplicate task_created (same taskId)
 *   E — missing taskId → gate skips, accepted
 *   F — task_rescheduled not gated, produces 0 derived memories
 *   G — gate disabled via SYNCO_INTEGRITY_GATE_ENABLED=false
 *   H — API response shape unchanged (no integrityStatus field)
 */

import { prisma } from '../server/lib/prisma.js';
import { runContextualDuplicateGate } from '../server/brain/services/learningIntegrityGate.js';
import { deriveFactualMemoriesFromLearningEvent } from '../server/brain/services/learningMemoryDerivation.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = `http://localhost:3001`;
const USER_ID  = 'gate-diag-user';

let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function info(label: string) {
  console.log(`  ℹ️  ${label}`);
}

async function postEvent(payload: Record<string, unknown>): Promise<{ ok: boolean; event?: Record<string, unknown>; integrityStatus?: string }> {
  const res = await fetch(`${BASE_URL}/api/learning/events`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId: USER_ID, ...payload }),
  });
  return res.json();
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Direct gate tests (unit-level, no HTTP) ──────────────────────────────────

async function testGateDirect(
  label: string,
  eventOverride: Partial<{
    id: string; userId: string; taskId: string | null;
    eventType: string; dateIso: string | null; occurredAt: Date;
  }>,
  expectedStatus: 'accepted' | 'duplicate_ignored',
  priorEvent?: { id: string; userId: string; taskId: string | null; eventType: string; dateIso: string | null; occurredAt: Date },
) {
  if (priorEvent) {
    await prisma.learningEvent.create({
      data: {
        id:                priorEvent.id,
        userId:            priorEvent.userId,
        taskId:            priorEvent.taskId,
        eventType:         priorEvent.eventType,
        dateIso:           priorEvent.dateIso,
        occurredAt:        priorEvent.occurredAt,
        taskTitleSnapshot: 'diag-test-task',
      },
    });
  }

  const event = {
    id:        eventOverride.id        ?? `diag-${Date.now()}`,
    userId:    eventOverride.userId    ?? USER_ID,
    taskId:    eventOverride.taskId    ?? `task-${Date.now()}`,
    eventType: eventOverride.eventType ?? 'task_completed',
    dateIso:   eventOverride.dateIso   ?? '2026-06-05',
    occurredAt: eventOverride.occurredAt ?? new Date(),
  };

  await prisma.learningEvent.create({
    data: {
      id:                event.id,
      userId:            event.userId,
      taskId:            event.taskId,
      eventType:         event.eventType,
      dateIso:           event.dateIso,
      occurredAt:        event.occurredAt,
      taskTitleSnapshot: 'diag-test-task',
    },
  });

  const result = await runContextualDuplicateGate(event);
  ok(label, result.status === expectedStatus);
  if (result.status === 'duplicate_ignored') {
    info(`  priorEventId=${result.priorEventId} diffMs=${result.occurredAtDiffMs}`);
  }
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────

async function cleanupDiagEvents() {
  await prisma.learningEvent.deleteMany({ where: { userId: USER_ID } });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' Synco Learning Integrity Gate — Diagnostics');
  console.log('══════════════════════════════════════════════════════════════════\n');

  await cleanupDiagEvents();

  // ── Diagnostic A — duplicate task_completed ─────────────────────────────
  console.log('── Diag A: duplicate task_completed (direct gate call) ──────────');
  {
    const taskId  = `diag-A-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 400); // 400ms apart — within 3s window

    const priorId = `diag-A-prior-${Date.now()}`;
    const thisId  = `diag-A-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId,  userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso, occurredAt: t1 });
    ok('second task_completed → duplicate_ignored', result.status === 'duplicate_ignored');
    ok('priorEventId is the first event', result.priorEventId === priorId);

    const noMems = deriveFactualMemoriesFromLearningEvent({ id: thisId, userId: USER_ID, eventType: 'task_completed', taskTitleSnapshot: 'diag', taskId, dateIso });
    ok('duplicate event still produces 1 derivation result (gate blocks write at route level, not derivation level)', noMems.length === 1);
    info('Gate correctly identified duplicate — route would skip storeUserMessage');
  }

  // ── Diagnostic B — duplicate task_execution_completed ───────────────────
  console.log('\n── Diag B: duplicate task_execution_completed ───────────────────');
  {
    const taskId  = `diag-B-task-${Date.now()}`;
    const dateIso = '2026-06-05';
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 2_000); // 2s apart — within 5s window

    const priorId = `diag-B-prior-${Date.now()}`;
    const thisId  = `diag-B-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: USER_ID, taskId, eventType: 'task_execution_completed', dateIso, occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId,  userId: USER_ID, taskId, eventType: 'task_execution_completed', dateIso, occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_execution_completed', dateIso, occurredAt: t1 });
    ok('second task_execution_completed → duplicate_ignored', result.status === 'duplicate_ignored');
    ok('occurredAtDiffMs ≈ 2000', Math.abs((result.occurredAtDiffMs ?? 0) - 2000) < 100);
    info(`windowMs=${result.windowMs} occurredAtDiffMs=${result.occurredAtDiffMs}`);
  }

  // ── Diagnostic C — recurring task: different dateIso → both accepted ─────
  console.log('\n── Diag C: recurring task — different dateIso → both accepted ───');
  {
    const taskId    = `diag-C-task-${Date.now()}`;
    const dateIso1  = '2026-06-04';
    const dateIso2  = '2026-06-05';
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 200); // 200ms — within window, but different dateIso

    const priorId = `diag-C-prior-${Date.now()}`;
    const thisId  = `diag-C-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: dateIso1, occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId,  userId: USER_ID, taskId, eventType: 'task_completed', dateIso: dateIso2, occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: dateIso2, occurredAt: t1 });
    ok('different dateIso → accepted (recurring task protection)', result.status === 'accepted');
    info(`dateIso1=${dateIso1} dateIso2=${dateIso2} → correctly distinct`);
  }

  // ── Diagnostic D — duplicate task_created (no dateIso match) ────────────
  console.log('\n── Diag D: duplicate task_created (same taskId, no dateIso req) ─');
  {
    const taskId  = `diag-D-task-${Date.now()}`;
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 300);

    const priorId = `diag-D-prior-${Date.now()}`;
    const thisId  = `diag-D-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: USER_ID, taskId, eventType: 'task_created', dateIso: '2026-06-04', occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId,  userId: USER_ID, taskId, eventType: 'task_created', dateIso: '2026-06-05', occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    // Different dateIso values — but task_created uses useDateIso=false, so taskId alone is the key
    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_created', dateIso: '2026-06-05', occurredAt: t1 });
    ok('task_created: same taskId, different dateIso → duplicate_ignored (dateIso not required)', result.status === 'duplicate_ignored');
  }

  // ── Diagnostic E — missing taskId → gate accepts ─────────────────────────
  console.log('\n── Diag E: missing taskId → gate accepts ────────────────────────');
  {
    const thisId = `diag-E-this-${Date.now()}`;
    await prisma.learningEvent.create({
      data: { id: thisId, userId: USER_ID, taskId: null, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: new Date(), taskTitleSnapshot: 'diag' },
    });
    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId: null, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: new Date() });
    ok('missing taskId → accepted (missing_task_id)', result.status === 'accepted');
    ok('reason is missing_task_id', result.reason === 'missing_task_id');
  }

  // ── Diagnostic F — task_rescheduled not gated, 0 derived memories ────────
  console.log('\n── Diag F: task_rescheduled not gated, 0 Qdrant memories ────────');
  {
    const taskId = `diag-F-task-${Date.now()}`;
    const thisId = `diag-F-this-${Date.now()}`;
    await prisma.learningEvent.create({
      data: { id: thisId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso: '2026-06-05', occurredAt: new Date(), taskTitleSnapshot: 'diag' },
    });

    // Gate should return accepted (not_gated)
    const gateResult = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_rescheduled', dateIso: '2026-06-05', occurredAt: new Date() });
    ok('task_rescheduled gate → accepted (event_not_gated)', gateResult.status === 'accepted' && gateResult.reason === 'event_not_gated');

    // Derivation engine returns 0 memories for task_rescheduled
    const mems = deriveFactualMemoriesFromLearningEvent({ id: thisId, userId: USER_ID, eventType: 'task_rescheduled', taskTitleSnapshot: 'diag reschedule', taskId, dateIso: '2026-06-05' });
    ok('task_rescheduled → 0 derived memories', mems.length === 0);
  }

  // ── Diagnostic G — gate disabled via env flag ─────────────────────────────
  console.log('\n── Diag G: gate disabled via SYNCO_INTEGRITY_GATE_ENABLED=false ─');
  {
    const taskId  = `diag-G-task-${Date.now()}`;
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 200);

    const priorId = `diag-G-prior-${Date.now()}`;
    const thisId  = `diag-G-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId,  userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    // Temporarily set flag to disabled
    const prevVal = process.env.SYNCO_INTEGRITY_GATE_ENABLED;
    process.env.SYNCO_INTEGRITY_GATE_ENABLED = 'false';
    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1 });
    // Restore
    if (prevVal === undefined) delete process.env.SYNCO_INTEGRITY_GATE_ENABLED;
    else process.env.SYNCO_INTEGRITY_GATE_ENABLED = prevVal;

    ok('gate disabled → accepted (disabled)', result.status === 'accepted');
    ok('reason is disabled', result.reason === 'disabled');
    info('Gate re-enabled after test');
  }

  // ── Diagnostic H — API response shape via live HTTP ──────────────────────
  console.log('\n── Diag H: API response shape (live HTTP) ────────────────────────');
  {
    try {
      const taskId = `diag-H-task-${Date.now()}`;
      const res = await postEvent({
        taskId,
        eventType: 'task_completed',
        dateIso: '2026-06-05',
        taskTitleSnapshot: 'diag-H-task',
        toStatus: 'completed',
      });

      ok('ok === true', res.ok === true);
      ok('event.id exists', typeof res.event?.id === 'string');
      ok('event.eventType exists', res.event?.eventType === 'task_completed');
      ok('event.occurredAt exists', typeof res.event?.occurredAt === 'string');
      ok('no integrityStatus field in response', !('integrityStatus' in res));
      info(`response keys: ${Object.keys(res).join(', ')}`);

      // Post same event again — should still return same shape (no integrityStatus)
      const taskId2 = taskId; // same taskId = would be duplicate_ignored server-side
      const res2 = await postEvent({
        taskId: taskId2,
        eventType: 'task_completed',
        dateIso: '2026-06-05',
        taskTitleSnapshot: 'diag-H-task',
        toStatus: 'completed',
      });

      ok('duplicate response: ok === true', res2.ok === true);
      ok('duplicate response: no integrityStatus field', !('integrityStatus' in res2));
      ok('duplicate response: event.id exists', typeof res2.event?.id === 'string');
      info('API response shape confirmed identical for both accepted and duplicate_ignored events');
    } catch (e) {
      console.warn('  ⚠️  HTTP test skipped (server not reachable):', (e as Error).message);
      info('Run with server running for Diag H HTTP tests');
    }
  }

  // ── Within-window but different userId → accepted ─────────────────────────
  console.log('\n── Diag I (bonus): different userId → not a duplicate ────────────');
  {
    const taskId  = `diag-I-task-${Date.now()}`;
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 300);

    const priorId = `diag-I-prior-${Date.now()}`;
    const thisId  = `diag-I-this-${Date.now()}`;

    await prisma.learningEvent.create({
      data: { id: priorId, userId: 'other-user', taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t0, taskTitleSnapshot: 'diag' },
    });
    await prisma.learningEvent.create({
      data: { id: thisId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1, taskTitleSnapshot: 'diag' },
    });

    const result = await runContextualDuplicateGate({ id: thisId, userId: USER_ID, taskId, eventType: 'task_completed', dateIso: '2026-06-05', occurredAt: t1 });
    ok('different userId with same taskId → accepted (not a duplicate)', result.status === 'accepted');
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await cleanupDiagEvents();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` Learning Integrity Gate Diagnostics — ${passed + failed} total`);
  console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Diagnostic script error:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
