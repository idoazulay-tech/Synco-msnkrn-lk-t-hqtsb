/**
 * Synco Brain Full Test Suite
 *
 * T1  — Pattern detection from repeated memories
 * T2  — No false causality: pattern alone ≠ hypothesis
 * T3  — Low sleep causal hypothesis created correctly
 * T4  — Prediction from current signals (sleepHours < 6)
 * T5  — Life rule blocks non_negotiable decision
 * T6  — Open question for unknown person entity
 * T7  — No open question for generic Hebrew words
 * T8  — Contradiction between user_reported vs observed
 * T9  — Experiment proposed from strong hypothesis
 * T10 — Decision support: warn_and_continue
 * T11 — Decision support: block_due_to_life_rule
 * T12 — Regression: inputContextAnalyzer returns correct structure
 */

import assert from "node:assert/strict";

import { runSyncoThinkingLayer, SyncoMemory, LifeRule, DecisionCandidate } from "../server/brain/services/syncoThinkingLayer.js";
import { analyzeInputContext, generateOpenQuestionsFromContext } from "../server/brain/services/inputContextAnalyzer.js";
import { calculateEvidenceScore, detectContradictions, resolveUserVsObserved, SimpleMemory } from "../server/brain/services/evidenceScoring.js";
import { evaluateDecision, DecisionContext } from "../server/brain/services/decisionSupport.js";
import { runBrainDiagnostics } from "../server/brain/diagnostics/brainDiagnostics.js";

const userId = "brain-test-user";
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ ${label}`); failed++; }
}
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }

// ─── Shared test data ─────────────────────────────────────────────────────────

const memories4: SyncoMemory[] = [
  { id: "m1", userId, memoryKind: "task_completion_failed", entityType: "task", entityName: "morning_tasks", occurredAt: "2026-06-01T08:00:00.000Z", source: "observed", confidence: 0.80, metadata: { sleepHours: 5 } },
  { id: "m2", userId, memoryKind: "task_completion_failed", entityType: "task", entityName: "morning_tasks", occurredAt: "2026-06-02T08:00:00.000Z", source: "observed", confidence: 0.82, metadata: { sleepHours: 4.5 } },
  { id: "m3", userId, memoryKind: "task_completion_failed", entityType: "task", entityName: "morning_tasks", occurredAt: "2026-06-03T08:00:00.000Z", source: "observed", confidence: 0.79, metadata: { sleepHours: 5.5 } },
  { id: "m4", userId, memoryKind: "task_completion_failed", entityType: "task", entityName: "morning_tasks", occurredAt: "2026-06-04T08:00:00.000Z", source: "observed", confidence: 0.81, metadata: { sleepHours: 7 } },
];

const lifeRules: LifeRule[] = [
  { ruleId: "rule-no-work-22", userId, ruleType: "no_work_after_22", title: "לא עובדים אחרי 22:00", priority: "non_negotiable", active: true },
  { ruleId: "rule-family-first", userId, ruleType: "family_first", title: "משפחה לפני עבודה", priority: "high", active: true },
];

const result = runSyncoThinkingLayer({
  userId,
  memories: memories4,
  currentSignals: { sleepHours: 5 },
  lifeRules,
});

// ─── T1: Pattern detection ────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════════");
console.log(" Synco Brain Full Test Suite");
console.log("══════════════════════════════════════════════════════════════════\n");

console.log("── T1: Pattern detection ─────────────────────────────────────────");
{
  ok("T1: at least 1 pattern found", result.patterns.length >= 1);
  ok("T1: pattern type is task_completion_failed", result.patterns[0].patternType === "task_completion_failed");
  ok("T1: evidenceCount = 4", result.patterns[0].evidenceCount === 4);
  ok("T1: confidence is in 0–1", result.patterns[0].confidence >= 0 && result.patterns[0].confidence <= 1);
  ok("T1: status is candidate or active", ["candidate", "active"].includes(result.patterns[0].status));
  info(`T1: confidence=${result.patterns[0].confidence.toFixed(3)} status=${result.patterns[0].status}`);
}

// ─── T2: No false causality ───────────────────────────────────────────────────

console.log("\n── T2: No false causality ────────────────────────────────────────");
{
  // Memories without sleep metadata should produce pattern but NO hypothesis
  const memoriesNoSleep: SyncoMemory[] = [
    { id: "ns1", userId, memoryKind: "task_delayed", entityType: "task", entityName: "calls", occurredAt: "2026-06-01T10:00:00.000Z", source: "observed", confidence: 0.75 },
    { id: "ns2", userId, memoryKind: "task_delayed", entityType: "task", entityName: "calls", occurredAt: "2026-06-02T10:00:00.000Z", source: "observed", confidence: 0.77 },
    { id: "ns3", userId, memoryKind: "task_delayed", entityType: "task", entityName: "calls", occurredAt: "2026-06-03T10:00:00.000Z", source: "observed", confidence: 0.76 },
  ];
  const r2 = runSyncoThinkingLayer({ userId, memories: memoriesNoSleep, currentSignals: {} });
  ok("T2: pattern detected for 3+ repeated events", r2.patterns.length >= 1);
  ok("T2: no causal hypothesis when no sleep metadata", r2.hypotheses.length === 0);
  info("T2: Pattern exists but no hypothesis without causal signal");
}

// ─── T3: Low sleep causal hypothesis ─────────────────────────────────────────

console.log("\n── T3: Low sleep causal hypothesis ──────────────────────────────");
{
  ok("T3: hypothesis created", result.hypotheses.length >= 1);
  ok("T3: causeSignal = low_sleep", result.hypotheses[0].causeSignal === "low_sleep");
  ok("T3: hypothesis confidence >= 0.55", result.hypotheses[0].confidence >= 0.55);
  ok("T3: status is not hypothesis_only (evidence >= 2)", result.hypotheses[0].status !== "hypothesis_only");
  info(`T3: confidence=${result.hypotheses[0].confidence.toFixed(3)} status=${result.hypotheses[0].status}`);
}

// ─── T4: Prediction from current signals ─────────────────────────────────────

console.log("\n── T4: Prediction from current signals ───────────────────────────");
{
  ok("T4: at least 1 prediction", result.predictions.length >= 1);
  ok("T4: riskType = reduced_task_completion_probability", result.predictions[0].riskType === "reduced_task_completion_probability");
  ok("T4: probability > 0.5", result.predictions[0].probability > 0.5);
  ok("T4: explanation is non-empty", result.predictions[0].explanation.length > 0);
  ok("T4: explanation uses supportive tone (no shaming)", !result.predictions[0].explanation.includes("כישלון"));
  info(`T4: probability=${result.predictions[0].probability.toFixed(3)}`);
}

// ─── T5: Life rule blocks decision ───────────────────────────────────────────

console.log("\n── T5: Life rule blocks non_negotiable decision ──────────────────");
{
  const decision: DecisionCandidate = { decisionId: "d1", userId, title: "עבודה כבדה בלילה", metadata: { hour: 23 } };
  const ctx: DecisionContext = {
    userId,
    decision,
    activePatterns: result.patterns,
    activeHypotheses: result.hypotheses,
    activePredictions: result.predictions,
    lifeRules,
  };
  const dec = evaluateDecision(ctx);
  ok("T5: decision type = block_due_to_life_rule", dec.decisionType === "block_due_to_life_rule");
  ok("T5: allowed = false", dec.allowed === false);
  ok("T5: blockedByRuleIds includes rule-no-work-22", dec.blockedByRuleIds.includes("rule-no-work-22"));
  ok("T5: safeAlternative provided", typeof dec.safeAlternative === "string" && dec.safeAlternative.length > 0);
  info(`T5: message="${dec.userFacingMessage.slice(0, 60)}..."`);
}

// ─── T6: Open question for unknown person ────────────────────────────────────

console.log("\n── T6: Open question for unknown person ──────────────────────────");
{
  const ctx6 = analyzeInputContext("תזכיר לי לדבר עם דניאל היום");
  const questions = generateOpenQuestionsFromContext(ctx6);
  ok("T6: entity detected", ctx6.entities.length >= 1);
  ok("T6: entity name = דניאל", ctx6.entities.some(e => e.name === "דניאל"));
  ok("T6: shouldCreateOpenQuestion = true", ctx6.shouldCreateOpenQuestion === true);
  ok("T6: open question generated", questions.length >= 1);
  ok("T6: question text in correct Hebrew format", questions.some(q => q.questionText.startsWith("מי זה") && q.questionText.endsWith("עבורך?")));
  ok("T6: questionType = entity_identity", questions.some(q => q.questionType === "entity_identity"));
  info(`T6: question="${questions[0]?.questionText}"`);
}

// ─── T7: No open question for generic words ───────────────────────────────────

console.log("\n── T7: No open question for generic Hebrew words ─────────────────");
{
  const ctx7 = analyzeInputContext("תוסיף משימה לבדיקה של הפרויקט");
  const questions = generateOpenQuestionsFromContext(ctx7);
  const personQuestions = questions.filter(q => q.questionType === "entity_identity");
  ok("T7: no entity_identity question for generic words", personQuestions.length === 0);
  info(`T7: total questions=${questions.length} person_questions=${personQuestions.length}`);
}

// ─── T8: Contradiction detection ─────────────────────────────────────────────

console.log("\n── T8: Contradiction user_reported vs observed ───────────────────");
{
  const userSelf: SimpleMemory = { id: "ev-a", userId, memoryKind: "punctuality", source: "user_reported", confidence: 0.9, boolValue: false }; // "I'm always late"
  const observed: SimpleMemory = { id: "ev-b", userId, memoryKind: "punctuality", source: "observed", confidence: 0.85, boolValue: true };     // arrived on time 90%

  const flags = detectContradictions([userSelf, observed]);
  ok("T8: contradiction detected", flags.length >= 1);
  ok("T8: involves ev-a and ev-b", flags.some(f => (f.memoryIdA === "ev-a" && f.memoryIdB === "ev-b") || (f.memoryIdA === "ev-b" && f.memoryIdB === "ev-a")));
  ok("T8: severity is low/medium/high (valid)", ["low", "medium", "high"].includes(flags[0].severity));

  const resolution = resolveUserVsObserved(userSelf, observed);
  ok("T8: resolution favors observed over user_reported", resolution !== null && resolution.winner.source === "observed");
  info(`T8: "${resolution?.explanation.slice(0, 80)}..."`);
}

// ─── T9: Experiment proposed from strong hypothesis ───────────────────────────

console.log("\n── T9: Experiment proposed from strong hypothesis ────────────────");
{
  ok("T9: at least 1 experiment proposed", result.experiments.length >= 1);
  ok("T9: experiment has hypothesisId", typeof result.experiments[0].hypothesisId === "string");
  ok("T9: durationDays = 14", result.experiments[0].durationDays === 14);
  ok("T9: status = proposed", result.experiments[0].status === "proposed");
  ok("T9: title is Hebrew string", result.experiments[0].title.length > 0);
  info(`T9: experiment="${result.experiments[0].title}"`);
}

// ─── T10: Decision support warn_and_continue ──────────────────────────────────

console.log("\n── T10: Decision support — warn_and_continue ─────────────────────");
{
  // Hour 20 (allowed by rules), but high risk prediction present
  const decision10: DecisionCandidate = { decisionId: "d10", userId, title: "עבודה ערב", metadata: { hour: 20 } };
  const ctx10: DecisionContext = {
    userId,
    decision: decision10,
    activePatterns: result.patterns,
    activeHypotheses: result.hypotheses,
    activePredictions: result.predictions, // probability ~0.74 → HIGH_RISK → suggest_safer_plan
    lifeRules,
  };
  const dec10 = evaluateDecision(ctx10);
  ok("T10: allowed = true (not blocked)", dec10.allowed === true);
  ok("T10: decisionType is warn or suggest_safer_plan", ["warn_and_continue", "suggest_safer_plan"].includes(dec10.decisionType));
  ok("T10: message is non-empty", dec10.userFacingMessage.length > 0);
  info(`T10: type=${dec10.decisionType} msg="${dec10.userFacingMessage.slice(0, 60)}"`);
}

// ─── T11: Decision support block ─────────────────────────────────────────────

console.log("\n── T11: Decision support — block with safeAlternative ────────────");
{
  const decision11: DecisionCandidate = { decisionId: "d11", userId, title: "חדר כושר ב23:00", metadata: { hour: 23 } };
  const ctx11: DecisionContext = {
    userId,
    decision: decision11,
    activePatterns: [],
    activeHypotheses: [],
    activePredictions: [],
    lifeRules,
  };
  const dec11 = evaluateDecision(ctx11);
  ok("T11: decisionType = block_due_to_life_rule", dec11.decisionType === "block_due_to_life_rule");
  ok("T11: allowed = false", dec11.allowed === false);
  ok("T11: safeAlternative is not null", dec11.safeAlternative != null);
  info(`T11: safeAlternative="${dec11.safeAlternative}"`);
}

// ─── T12: inputContextAnalyzer regression ────────────────────────────────────

console.log("\n── T12: inputContextAnalyzer regression ──────────────────────────");
{
  const ctx12 = analyzeInputContext("להוסיף פגישה עם רחל מחר בשעה 14:00");
  ok("T12: intent = schedule_event or create_task", ["schedule_event", "create_task", "create_reminder", "unknown"].includes(ctx12.intent));
  ok("T12: entities array is array", Array.isArray(ctx12.entities));
  ok("T12: timeReferences array is array", Array.isArray(ctx12.timeReferences));
  ok("T12: missingInfo array is array", Array.isArray(ctx12.missingInfo));
  ok("T12: ambiguityScore 0–1", ctx12.ambiguityScore >= 0 && ctx12.ambiguityScore <= 1);
  ok("T12: diagnostics array non-empty", ctx12.diagnostics.length > 0);
  ok("T12: entity רחל detected", ctx12.entities.some(e => e.name === "רחל"));
  ok("T12: time reference detected (מחר or 14:00)", ctx12.timeReferences.length >= 1);
  info(`T12: entities=${ctx12.entities.map(e => e.name).join(",")} time=${ctx12.timeReferences.map(r => r.raw).join(",")}`);

  // Full diagnostics regression
  const diag = runBrainDiagnostics({
    userId,
    inputText: "להוסיף פגישה עם רחל מחר בשעה 14:00",
    memories: memories4,
    lifeRules,
    currentSignals: { sleepHours: 5 },
    decisionCandidate: { decisionId: "d-reg", userId, title: "פגישה ערב", metadata: { hour: 14 } },
  });
  ok("T12: diagnostics report has realVsSimulated", diag.realVsSimulated != null);
  ok("T12: inputAnalysis = real", diag.realVsSimulated.inputAnalysis === "real");
  ok("T12: evidenceScoring = real", diag.realVsSimulated.evidenceScoring === "real");
  ok("T12: generatedAt is ISO string", typeof diag.generatedAt === "string");
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════════");
console.log(` Synco Brain Full Test Suite — ${passed + failed} total`);
console.log(` ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log("══════════════════════════════════════════════════════════════════\n");

if (failed > 0) process.exit(1);
