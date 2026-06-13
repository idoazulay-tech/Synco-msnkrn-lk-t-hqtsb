/**
 * Synco Phase 8 — Continuous Brain Foundation Tests
 *
 * Coverage:
 * 1.  RawEvent preserves privacy metadata
 * 2.  Hebrew commitment text creates commitment_signal
 * 3.  Hebrew financial text creates financial_signal
 * 4.  Unknown person creates Open Question in Hebrew
 * 5.  Generic words do not create person open questions
 * 6.  commitment_signal routes to commitment memory
 * 7.  knowledge_signal routes to knowledge memory
 * 8.  Signal with shouldUpdateWiki creates wiki update candidate
 * 9.  Signal with shouldUpdateGraph creates graph node candidate
 * 10. Raw content can be marked as session_only (temporary)
 * 11. All derived objects have ownerId === userId
 * 12. Pipeline returns full diagnostics
 * 13. No user-facing English messages in open questions
 * 14. Existing Phase 4/5/6/7 tests still pass (import check)
 * 15. Pipeline safe fallback on error
 * 16. "אחזור אליך מחר" without named person triggers missing-target question
 * 17. Interest signal detected from content consumption
 * 18. Emotional signal detected
 * 19. Known entity suppresses open question
 * 20. Privacy: financial signals get sensitive privacy
 */

import { createRawEvent } from '../server/brain/types/rawEvent.js';
import { defaultPrivacy, sessionOnlyPrivacy } from '../server/brain/types/privacy.js';
import { createSignal } from '../server/brain/types/signal.js';
import { runMeaningEngine } from '../server/brain/services/meaningEngine.js';
import { routeSignalsToMemory } from '../server/brain/services/memoryRouter.js';
import {
  runContinuousBrainFoundation,
  runContinuousBrainFromText,
} from '../server/brain/services/continuousBrainPipeline.js';

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

const USER = 'user-p8-test';

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Phase 8 Continuous Brain Foundation Tests ===\n');

// ── 1. RawEvent preserves privacy metadata
console.log('Test 1: RawEvent preserves privacy metadata');
{
  const re = createRawEvent(USER, 'בדיקה פשוטה');
  assert(re.privacy.ownerId === USER, `ownerId === userId`);
  assert(re.privacy.visibility === 'private', `visibility = private`);
  assert(re.privacy.canDelete === true, `canDelete = true`);
  assert(re.privacy.canExport === true, `canExport = true`);
  assert(re.privacy.retentionPolicy === '7_days', `retentionPolicy = 7_days (default)`);
  assert(typeof re.privacy.rawRetentionUntil === 'string', `rawRetentionUntil is a date string`);
  assert(re.processingStatus === 'pending', `processingStatus = pending`);
}

// ── 2. Commitment signal from Hebrew commitment text
console.log('Test 2: Hebrew commitment text → commitment_signal');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  const commitSignals = result.signals.filter(s => s.signalType === 'commitment_signal');
  assert(commitSignals.length > 0, 'commitment_signal detected');
  assert(commitSignals[0].shouldCreateTask === true, 'commitment_signal sets shouldCreateTask');
  assert(commitSignals[0].confidence >= 0.5, `confidence >= 0.5 (got ${commitSignals[0].confidence})`);
}

// ── 3. Financial signal from Hebrew financial text
console.log('Test 3: Hebrew financial text → financial_signal');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  const finSignals = result.signals.filter(s => s.signalType === 'financial_signal');
  assert(finSignals.length > 0, 'financial_signal detected');
  assert(finSignals[0].privacy.sensitivityLevel === 'sensitive', 'financial signal gets sensitive privacy');
}

// ── 4. Unknown person → Open Question in Hebrew
console.log('Test 4: Unknown person → Hebrew open question');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  const personQ = result.openQuestions.find(q => q.questionType === 'who_is_person');
  assert(personQ !== undefined, 'who_is_person question generated');
  assert(personQ !== undefined && /[א-ת]/.test(personQ.questionText), 'question text contains Hebrew');
  assert(personQ !== undefined && personQ.questionText.includes('דני'), 'question mentions "דני"');
}

// ── 5. Generic words do not create person open questions
console.log('Test 5: Generic words → no person open question');
{
  const result = runContinuousBrainFromText(USER, 'לדבר עם מישהו בצוות על הפרויקט');
  const personQ = result.openQuestions.filter(q => q.questionType === 'who_is_person');
  assert(personQ.length === 0, 'no who_is_person question for generic words');
}

// ── 6. commitment_signal routes to commitment memory
console.log('Test 6: commitment_signal → commitment memory');
{
  const rawEvent = createRawEvent(USER, 'צריך לשלם לדני עד סוף השבוע');
  const meaning = runMeaningEngine(rawEvent);
  const commitSigs = meaning.signals.filter(s => s.signalType === 'commitment_signal');
  assert(commitSigs.length > 0, 'commitment_signal found');
  const plan = routeSignalsToMemory({ signals: commitSigs });
  assert(plan.commitmentMemories.length > 0, 'routed to commitment memories');
  assert(plan.episodicMemories.length === 0, 'not in episodic memories');
}

// ── 7. knowledge_signal routes to knowledge memory
console.log('Test 7: knowledge_signal → knowledge memory');
{
  const rawEvent = createRawEvent(USER, 'קראתי מאמר מעניין על ניהול זמן');
  const meaning = runMeaningEngine(rawEvent);
  const knowSigs = meaning.signals.filter(s => s.signalType === 'knowledge_signal');
  assert(knowSigs.length > 0, 'knowledge_signal detected');
  const plan = routeSignalsToMemory({ signals: knowSigs });
  assert(plan.knowledgeMemories.length > 0, 'routed to knowledge memories');
}

// ── 8. Signal with shouldUpdateWiki → wiki update candidate
console.log('Test 8: shouldUpdateWiki → wiki update candidate');
{
  const result = runContinuousBrainFromText(USER, 'קראתי מאמר על ניהול חובות והלוואות');
  assert(result.wikiUpdateCandidates.length > 0, 'wiki update candidates generated');
  assert(result.wikiUpdateCandidates[0].action === 'update', 'action is update');
  assert(Array.isArray(result.wikiUpdateCandidates[0].newKeyPoints), 'newKeyPoints is array');
}

// ── 9. Signal with shouldUpdateGraph → graph node candidate
console.log('Test 9: shouldUpdateGraph → graph node candidate');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  assert(result.graphUpdateCandidates.length > 0, 'graph update candidates generated');
  const nodes = result.graphUpdateCandidates.flatMap(g => g.nodesToCreate);
  const personNode = nodes.find(n => n.nodeType === 'person');
  assert(personNode !== undefined, 'person node candidate created for "דני"');
  assert(personNode?.label === 'דני', `person node label = "דני" (got ${personNode?.label})`);
}

// ── 10. Raw content can be marked session_only
console.log('Test 10: session_only privacy');
{
  const privacy = sessionOnlyPrivacy(USER);
  assert(privacy.retentionPolicy === 'session_only', 'retentionPolicy = session_only');
  assert(privacy.canDelete === true, 'canDelete = true');
  const rawEvent = createRawEvent(USER, 'מידע זמני', 'quick_input', { privacy });
  assert(rawEvent.privacy.retentionPolicy === 'session_only', 'RawEvent carries session_only policy');
}

// ── 11. All derived objects have ownerId === userId
console.log('Test 11: ownerId === userId throughout pipeline');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  const allSignals = result.signals;
  assert(allSignals.every(s => s.userId === USER), 'all signals have correct userId');
  assert(allSignals.every(s => s.privacy.ownerId === USER), 'all signal privacy.ownerId === userId');
  const memPlan = result.memoryRoutingPlan;
  if (memPlan) {
    const allMems = [
      ...memPlan.episodicMemories,
      ...memPlan.behavioralMemories,
      ...memPlan.knowledgeMemories,
      ...memPlan.preferenceMemories,
      ...memPlan.commitmentMemories,
    ];
    assert(allMems.every(m => m.ownerId === USER), 'all routed memories have correct ownerId');
  }
}

// ── 12. Pipeline returns full diagnostics
console.log('Test 12: Full diagnostics returned');
{
  const result = runContinuousBrainFromText(USER, 'תחזור לדני מחר לגבי החזר כסף');
  assert(result.ok === true, 'ok = true');
  assert(Array.isArray(result.diagnostics), 'diagnostics is array');
  assert(result.diagnostics.length > 0, 'diagnostics non-empty');
  assert(result.rawEventDiagnostics.length > 0, 'rawEventDiagnostics non-empty');
  assert(result.diagnostics.some(d => d.includes('userId=')), 'diagnostics include userId');
}

// ── 13. No user-facing English messages in open questions
console.log('Test 13: Open questions are Hebrew-only');
{
  const texts = [
    'תחזור לדני מחר לגבי החזר כסף',
    'לדבר עם רחל על הפרויקט',
    'אחזור אליך מחר לגבי זה',
  ];
  for (const text of texts) {
    const result = runContinuousBrainFromText(USER, text);
    for (const q of result.openQuestions) {
      const hasHebrew = /[א-ת]/.test(q.questionText);
      assert(hasHebrew, `open question is Hebrew: "${q.questionText.slice(0, 40)}"`);
    }
  }
}

// ── 14. Import check — Phase 7 modules still importable
console.log('Test 14: Phase 7 modules still importable');
{
  // Dynamic import check — just verify no exceptions on import of phase 7 modules
  try {
    await import('../server/brain/services/patternDecay.js');
    await import('../server/brain/services/recentTrendAnalyzer.js');
    await import('../server/brain/services/brainRecommendation.js');
    await import('../server/brain/services/patternExplainability.js');
    assert(true, 'Phase 7 modules import successfully');
  } catch (e) {
    assert(false, `Phase 7 import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── 15. Pipeline safe fallback on internal error
console.log('Test 15: Safe fallback when rawEvent has no content');
{
  const badEvent = createRawEvent(USER, ''); // empty content
  const result = runContinuousBrainFoundation({ userId: USER, rawEvent: badEvent });
  // Should not throw; may produce minimal signals
  assert(typeof result.ok === 'boolean', 'ok is boolean (no throw)');
  assert(Array.isArray(result.signals), 'signals is array even for empty input');
}

// ── 16. "אחזור אליך מחר" without named person → missing-target question
console.log('Test 16: "אחזור אליך מחר" → missing commitment target question');
{
  const result = runContinuousBrainFromText(USER, 'אחזור אליך מחר');
  const missingQ = result.openQuestions.find(q => q.questionType === 'missing_commitment_target');
  assert(missingQ !== undefined, 'missing_commitment_target question generated');
  assert(missingQ !== undefined && /[א-ת]/.test(missingQ.questionText), 'question is Hebrew');
}

// ── 17. Interest signal from content consumption
console.log('Test 17: Interest signal from content consumption');
{
  const result = runContinuousBrainFromText(USER, 'ראיתי 5 סרטונים על חובות והלוואות');
  const interestSigs = result.signals.filter(s => s.signalType === 'interest_signal');
  assert(interestSigs.length > 0, 'interest_signal detected from content consumption');
}

// ── 18. Emotional signal detected
console.log('Test 18: Emotional signal detected');
{
  const result = runContinuousBrainFromText(USER, 'קשה לי מאוד עם המשימה הזו, אני מרגיש לחץ');
  const emotSigs = result.signals.filter(s => s.signalType === 'emotional_signal');
  assert(emotSigs.length > 0, 'emotional_signal detected');
  assert(emotSigs[0].suggestedMemoryType === 'behavioral', 'emotional signal → behavioral memory');
}

// ── 19. Known entity suppresses open question
console.log('Test 19: Known entity suppresses who_is_person question');
{
  const result = runContinuousBrainFromText(
    USER,
    'תחזור לדני מחר',
    'quick_input',
    { knownEntities: ['דני'] },
  );
  const personQ = result.openQuestions.filter(q =>
    q.questionType === 'who_is_person' && q.relatedEntityName === 'דני',
  );
  assert(personQ.length === 0, 'no who_is_person for known entity "דני"');
}

// ── 20. Financial signals get sensitive privacy
console.log('Test 20: Financial signals → sensitive privacy');
{
  const rawEvent = createRawEvent(USER, 'יש לי חוב של 5000 ש"ח ל-דני');
  const meaning = runMeaningEngine(rawEvent);
  const finSignals = meaning.signals.filter(s => s.signalType === 'financial_signal');
  assert(finSignals.length > 0, 'financial_signal detected');
  assert(
    finSignals.every(s => s.privacy.sensitivityLevel === 'sensitive'),
    'all financial signals have sensitive privacy',
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (errors.length > 0) {
  console.error('\nFailed tests:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ All Phase 8 tests passed.');
}
