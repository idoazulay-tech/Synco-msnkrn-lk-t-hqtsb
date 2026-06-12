import assert from "node:assert/strict";
import {
  runSyncoThinkingLayer,
  SyncoMemory,
  LifeRule
} from "../server/brain/services/syncoThinkingLayer";

const userId = "user_1";

const memories: SyncoMemory[] = [
  {
    id: "m1",
    userId,
    memoryKind: "task_completion_failed",
    entityType: "task",
    entityName: "morning_tasks",
    occurredAt: "2026-06-01T08:00:00.000Z",
    source: "observed",
    confidence: 0.8,
    metadata: { sleepHours: 5 }
  },
  {
    id: "m2",
    userId,
    memoryKind: "task_completion_failed",
    entityType: "task",
    entityName: "morning_tasks",
    occurredAt: "2026-06-02T08:00:00.000Z",
    source: "observed",
    confidence: 0.82,
    metadata: { sleepHours: 4.5 }
  },
  {
    id: "m3",
    userId,
    memoryKind: "task_completion_failed",
    entityType: "task",
    entityName: "morning_tasks",
    occurredAt: "2026-06-03T08:00:00.000Z",
    source: "observed",
    confidence: 0.79,
    metadata: { sleepHours: 5.5 }
  },
  {
    id: "m4",
    userId,
    memoryKind: "task_completion_failed",
    entityType: "task",
    entityName: "morning_tasks",
    occurredAt: "2026-06-04T08:00:00.000Z",
    source: "observed",
    confidence: 0.81,
    metadata: { sleepHours: 7 }
  }
];

const lifeRules: LifeRule[] = [
  {
    ruleId: "rule_1",
    userId,
    ruleType: "no_work_after_22",
    title: "לא עובדים אחרי 22:00",
    priority: "non_negotiable",
    active: true
  }
];

const result = runSyncoThinkingLayer({
  userId,
  memories,
  currentSignals: {
    sleepHours: 5
  },
  lifeRules,
  decisionCandidate: {
    decisionId: "decision_1",
    userId,
    title: "לעבוד על משימה כבדה בלילה",
    metadata: {
      hour: 23
    }
  }
});

assert.equal(result.patterns.length, 1);
assert.equal(result.patterns[0].patternType, "task_completion_failed");
assert.ok(result.patterns[0].confidence > 0.5);

assert.equal(result.hypotheses.length, 1);
assert.equal(result.hypotheses[0].causeSignal, "low_sleep");
assert.ok(result.hypotheses[0].confidence >= 0.55);

assert.equal(result.predictions.length, 1);
assert.equal(result.predictions[0].riskType, "reduced_task_completion_probability");
assert.ok(result.predictions[0].probability > 0.6);

assert.equal(result.experiments.length, 1);
assert.equal(result.experiments[0].durationDays, 14);

assert.equal(result.lifeRuleEvaluation?.allowed, false);
assert.deepEqual(result.lifeRuleEvaluation?.blockedByRuleIds, ["rule_1"]);

console.log("✅ Synco Thinking Layer tests passed");
console.log(JSON.stringify(result, null, 2));
