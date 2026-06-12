/**
 * Synco Brain Diagnostics
 *
 * Runs the full brain pipeline on a given input and returns a transparent
 * step-by-step trace of every decision. No magic, no hidden logic.
 *
 * Usage:
 *   import { runBrainDiagnostics } from './brainDiagnostics.js';
 *   const report = runBrainDiagnostics({ userId, inputText, memories, lifeRules, currentSignals });
 *
 * Also exposed as a dev-only Express endpoint in server/routes/brain.ts (if wired up).
 */

import { analyzeInputContext, generateOpenQuestionsFromContext } from "../services/inputContextAnalyzer.js";
import { calculateEvidenceScore, detectContradictions, SimpleMemory } from "../services/evidenceScoring.js";
import { runSyncoThinkingLayer, SyncoMemory, LifeRule, DecisionCandidate } from "../services/syncoThinkingLayer.js";
import { evaluateDecision, DecisionContext } from "../services/decisionSupport.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainDiagnosticsInput {
  userId: string;
  inputText: string;
  memories: SyncoMemory[];
  lifeRules?: LifeRule[];
  currentSignals?: Record<string, unknown>;
  decisionCandidate?: DecisionCandidate;
  evidenceMemories?: SimpleMemory[];
}

export interface BrainDiagnosticsReport {
  userId: string;
  inputText: string;

  // Step 1: input analysis
  inputContext: ReturnType<typeof analyzeInputContext>;
  suggestedOpenQuestions: ReturnType<typeof generateOpenQuestionsFromContext>;

  // Step 2: evidence scoring (sample of first 5 memories)
  evidenceSample: Array<{
    memoryId: string;
    source: string;
    rawConfidence: number;
    evidenceScore: ReturnType<typeof calculateEvidenceScore>;
  }>;

  // Step 3: contradiction flags
  contradictions: ReturnType<typeof detectContradictions>;

  // Step 4: patterns, hypotheses, predictions, experiments
  patterns: ReturnType<typeof runSyncoThinkingLayer>["patterns"];
  hypotheses: ReturnType<typeof runSyncoThinkingLayer>["hypotheses"];
  predictions: ReturnType<typeof runSyncoThinkingLayer>["predictions"];
  experiments: ReturnType<typeof runSyncoThinkingLayer>["experiments"];

  // Step 5: decision support
  decisionResult: ReturnType<typeof evaluateDecision> | null;

  // What is real vs. simulated
  realVsSimulated: {
    inputAnalysis: "real" | "simulated";
    evidenceScoring: "real" | "simulated";
    patternDetection: "real" | "simulated";
    causalHypotheses: "real" | "simulated";
    predictions: "real" | "simulated";
    lifeRules: "real" | "simulated";
    openQuestions: "real" | "simulated";
    qdrantMemory: "real" | "simulated";
    postgresMemory: "real" | "simulated";
    notes: string[];
  };

  generatedAt: string;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function runBrainDiagnostics(
  input: BrainDiagnosticsInput
): BrainDiagnosticsReport {
  // Step 1: analyze input
  const inputContext = analyzeInputContext(input.inputText);
  const suggestedOpenQuestions = generateOpenQuestionsFromContext(inputContext);

  // Step 2: evidence scoring on supplied memories
  const evidenceSample = (input.evidenceMemories ?? [])
    .slice(0, 5)
    .map(m => ({
      memoryId: m.id,
      source: m.source,
      rawConfidence: m.confidence,
      evidenceScore: calculateEvidenceScore({
        source: m.source,
        confidence: m.confidence,
      }),
    }));

  // Step 3: contradiction detection
  const contradictions = detectContradictions(input.evidenceMemories ?? []);

  // Step 4: thinking layer
  const thinkingResult = runSyncoThinkingLayer({
    userId: input.userId,
    memories: input.memories,
    currentSignals: input.currentSignals ?? {},
    lifeRules: input.lifeRules ?? [],
    decisionCandidate: input.decisionCandidate,
  });

  // Step 5: decision support (only if a candidate was provided)
  let decisionResult: ReturnType<typeof evaluateDecision> | null = null;
  if (input.decisionCandidate) {
    const decisionCtx: DecisionContext = {
      userId: input.userId,
      decision: input.decisionCandidate,
      activePatterns: thinkingResult.patterns,
      activeHypotheses: thinkingResult.hypotheses,
      activePredictions: thinkingResult.predictions,
      lifeRules: input.lifeRules ?? [],
      currentSignals: input.currentSignals,
    };
    decisionResult = evaluateDecision(decisionCtx);
  }

  // Real vs. simulated transparency report
  const hasRealMemories = input.memories.length > 0;
  const hasRealRules = (input.lifeRules ?? []).length > 0;

  return {
    userId: input.userId,
    inputText: input.inputText,
    inputContext,
    suggestedOpenQuestions,
    evidenceSample,
    contradictions,
    patterns: thinkingResult.patterns,
    hypotheses: thinkingResult.hypotheses,
    predictions: thinkingResult.predictions,
    experiments: thinkingResult.experiments,
    decisionResult,
    realVsSimulated: {
      inputAnalysis: "real",
      evidenceScoring: "real",
      patternDetection: hasRealMemories ? "real" : "simulated",
      causalHypotheses: hasRealMemories ? "real" : "simulated",
      predictions: hasRealMemories ? "real" : "simulated",
      lifeRules: hasRealRules ? "real" : "simulated",
      openQuestions: "real",
      qdrantMemory: "simulated",
      postgresMemory: "simulated",
      notes: [
        "inputAnalysis: pure regex/heuristic, no AI call — always real",
        "evidenceScoring: pure math — always real",
        "patternDetection: reads from supplied SyncoMemory[] — real only if caller passes real DB data",
        "causalHypotheses: derived from patterns — real if patterns are real",
        "predictions: derived from hypotheses + currentSignals — real if hypotheses are real",
        "lifeRules: evaluated against supplied LifeRule[] — real only if caller passes real rules",
        "openQuestions: generated from inputAnalysis — always real logic, persistence requires DB call by caller",
        "qdrantMemory: NOT read in this diagnostic — would need real Qdrant connection",
        "postgresMemory: NOT read in this diagnostic — memories are injected by caller",
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}
