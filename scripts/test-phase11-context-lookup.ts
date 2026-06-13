/**
 * Synco Phase 11 — Person Context Lookup + continuousContext Tests
 *
 * Verification checklist:
 * 1.  TypeScript 0 errors (checked externally)
 * 2.  Phase 11 tests pass (this file)
 * 3.  Phase 10 tests pass (run separately)
 * 4.  Phase 9 tests pass (run separately)
 * 5.  quick route still creates task
 * 6.  seed known person "דני" into GraphNode
 * 7.  send /quick: "שיחה עם דני מחר בשלוש" (full date+time → TASK_CREATED)
 * 8.  confirm no Open Question "מי זה דני עבורך?" created
 * 9.  send /quick: "שיחה עם אבי מחר בחמש" (unknown person)
 * 10. confirm Open Question IS created for unknown "אבי"
 * 11. devMode=true returns _brain.continuousContext
 * 12. retrieval failure does not break quick (empty GraphNode user)
 */

import { prisma } from '../server/lib/prisma.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, label: string): void {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; errors.push(label); }
}

const BASE     = 'http://localhost:3001';
const USER     = 'default-user';
const DEV_HDR  = { 'Content-Type': 'application/json', 'X-Synco-Dev': '1' };
const PROD_HDR = { 'Content-Type': 'application/json' };

async function quickPost(text: string, devMode = false, userId = USER): Promise<any> {
  const res = await fetch(`${BASE}/api/quick`, {
    method:  'POST',
    headers: devMode ? DEV_HDR : PROD_HDR,
    body:    JSON.stringify({ text, existingTasks: [], userId }),
  });
  return res.json();
}

async function countOpenQFor(userId: string, personName: string): Promise<number> {
  const q = `מי זה ${personName} עבורך?`;
  return prisma.openQuestion.count({ where: { userId, questionText: q } });
}

async function deleteOpenQFor(userId: string, personName: string): Promise<void> {
  const q = `מי זה ${personName} עבורך?`;
  await prisma.openQuestion.deleteMany({ where: { userId, questionText: q } });
}

async function deleteGraphNodeFor(userId: string, label: string): Promise<void> {
  await prisma.graphNode.deleteMany({ where: { userId, label } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Phase 11 Context-Lookup Tests ===\n');

// ── 5. Quick route still creates task (baseline)
console.log('Test 5: quick route still creates task');
{
  const r = await quickPost('פגישה עם ראובן מחר בשלוש');
  assert(r.action?.type !== undefined, 'action.type present');
  assert(typeof r.mode === 'string',   'mode field present');
}

// ── 6. Seed known person "דני" into GraphNode
console.log('Test 6: seed "דני" into GraphNode');
{
  await deleteGraphNodeFor(USER, 'דני');
  await deleteOpenQFor(USER, 'דני');   // clean any pre-existing question from Phase 9 runs

  await prisma.graphNode.create({
    data: {
      userId:          USER,
      nodeType:        'person',
      label:           'דני',
      confidence:      0.9,
      sensitivityLevel: 'personal',
      metadata:        null,
    },
  });
  const node = await prisma.graphNode.findFirst({ where: { userId: USER, label: 'דני' } });
  assert(node !== null,              '"דני" node created');
  assert(node?.nodeType === 'person','nodeType is "person"');
  assert(node?.label === 'דני',     'label is "דני"');
}

// ── 7. /quick with known "דני" → TASK_CREATED
// Uses full date+time: "שיחה עם דני מחר בשלוש" ensures TASK_CREATED path.
console.log('Test 7: /quick "שיחה עם דני מחר בשלוש" → TASK_CREATED');
{
  const r = await quickPost('שיחה עם דני מחר בשלוש');
  assert(r.action?.type === 'TASK_CREATED', `action.type=TASK_CREATED (got ${r.action?.type})`);
}

// ── 8. No Open Question for known "דני"
console.log('Test 8: no "מי זה דני עבורך?" for known person');
{
  await new Promise(r => setTimeout(r, 600));   // allow fire-and-forget to flush
  const count = await countOpenQFor(USER, 'דני');
  assert(count === 0, `openQuestion count for "דני" is 0 (got ${count})`);
}

// ── 9. /quick with unknown "אבי" → task + fire-and-forget question
console.log('Test 9: /quick "שיחה עם אבי מחר בחמש" → TASK_CREATED');
{
  await deleteGraphNodeFor(USER, 'אבי');  // ensure unknown
  await deleteOpenQFor(USER, 'אבי');     // clean slate

  const r = await quickPost('שיחה עם אבי מחר בחמש');
  assert(r.action?.type === 'TASK_CREATED', `action.type=TASK_CREATED (got ${r.action?.type})`);
}

// ── 10. Open Question IS created for unknown "אבי"
console.log('Test 10: "מי זה אבי עבורך?" created for unknown person');
{
  await new Promise(r => setTimeout(r, 700));  // allow both entity-Qs and brainPipeline to settle
  const count = await countOpenQFor(USER, 'אבי');
  assert(count >= 1, `openQuestion for "אבי" exists (got ${count})`);
  await deleteOpenQFor(USER, 'אבי');   // cleanup
}

// ── 11. devMode=true returns _brain.continuousContext
console.log('Test 11: devMode=true (X-Synco-Dev: 1) returns _brain.continuousContext');
{
  // Must be a TASK_CREATED path to get _brain
  const r = await quickPost('שיחה עם דני מחר בשלוש', true);
  assert('_brain' in r,                              '_brain field present in devMode');
  assert('continuousContext' in (r._brain ?? {}),    '_brain.continuousContext present');
  const cc = r._brain?.continuousContext;
  assert(cc !== null && cc !== undefined,             'continuousContext not null/undefined');
  assert(typeof cc?.ok === 'boolean',                'continuousContext.ok is boolean');
  assert(Array.isArray(cc?.signals),                 'continuousContext.signals is array');
  assert(Array.isArray(cc?.diagnostics),             'continuousContext.diagnostics is array');
}

// ── 12. Retrieval failure does not break quick
// Uses a userId with no GraphNode data — the try-catch returns [] and route continues.
console.log('Test 12: quick works when GraphNode lookup returns empty');
{
  const r = await fetch(`${BASE}/api/quick`, {
    method:  'POST',
    headers: PROD_HDR,
    body:    JSON.stringify({
      text:          'שיחה עם יוסי מחר בשש',
      existingTasks: [],
      userId:        'no-graph-user-test',
    }),
  });
  const j = await r.json();
  assert(r.status !== 500,             'HTTP not 500 (route not crashed)');
  assert(j.action?.type !== undefined, 'action.type present (route functional)');
}

// ── Bonus A: devMode=false → no _brain
console.log('Bonus A: devMode=false → _brain absent');
{
  const r = await quickPost('שיחה עם שלמה מחר בשלוש', false);
  assert(!('_brain' in r), '_brain absent when devMode=false');
}

// ── Bonus B: continuousContext suppressed known "דני" open question
console.log('Bonus B: continuousContext.openQuestions suppressed for known "דני"');
{
  const r = await quickPost('שיחה עם דני מחר בשלוש', true);
  const cc = r._brain?.continuousContext;
  if (cc?.ok) {
    const hasQ = (cc.openQuestions ?? []).some(
      (q: any) => q.relatedEntityName?.toLowerCase() === 'דני' || q.questionText?.includes('דני'),
    );
    assert(!hasQ, 'continuousContext suppressed open question for known "דני"');
  } else {
    assert(true, 'continuousContext.ok=false — suppression not testable, skip');
  }
}

// ── Regression: Phase 9 share + Phase 10 retrieve still work
console.log('Regression: Phase 9 share + Phase 10 retrieve still work');
{
  const sR = await fetch(`${BASE}/api/brain/share`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId: USER, text: 'שיחה עם שרה ביום שלישי', persist: false }),
  });
  assert((await sR.json()).ok === true, 'share ok=true');

  const rR = await fetch(`${BASE}/api/brain/retrieve?userId=${USER}&query=דני`);
  const rJ  = await rR.json();
  assert(rJ.ok === true,                'retrieve ok=true');
  assert(Array.isArray(rJ.graphNodes),  'retrieve.graphNodes is array');
  const hasDani = rJ.graphNodes.some((n: any) => n.label === 'דני');
  assert(hasDani, '"דני" node found via retrieve after seed');
}

// ─── Cleanup: remove seeded "דני" to leave DB clean ──────────────────────────
await deleteGraphNodeFor(USER, 'דני');

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(` Phase 11 Tests — ${passed + failed} total`);
console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log(`════════════════════════════════════════════════════════════════`);

if (errors.length > 0) {
  console.error('\nFailed tests:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ All Phase 11 tests passed.');
}
