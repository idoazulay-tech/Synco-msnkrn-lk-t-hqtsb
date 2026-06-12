/**
 * Synco Brain Pipeline
 *
 * Orchestrates the full brain flow for a single user input:
 *   input text
 *   → analyzeInputContext
 *   → generateOpenQuestionsFromContext
 *   → persistDeferredQuestions (fire-and-forget, never blocking)
 *   → decisionSupport (using available memories + life rules)
 *   → brainDiagnostics (dev mode only)
 *
 * Design constraints:
 * - ANY failure in this pipeline must be caught and return a safe fallback.
 * - Never throws. Never blocks task creation.
 * - Does not read from Qdrant or PostgreSQL directly — callers inject data.
 *   When real data is unavailable, the diagnostics honestly say so.
 * - All Open Questions persist via persistDeferredQuestions (fire-and-forget).
 */

import { analyzeInputContext, generateOpenQuestionsFromContext, AnalyzedInputContext } from './inputContextAnalyzer.js';
import { evaluateDecision, SupportedDecision, DecisionContext } from './decisionSupport.js';
import { persistDeferredQuestions } from './openQuestions.js';
import type { SyncoMemory, LifeRule, DecisionCandidate, SyncoPattern, CausalHypothesis, PredictionRisk } from './syncoThinkingLayer.js';
import { runSyncoThinkingLayer } from './syncoThinkingLayer.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainPipelineInput {
  userId: string;
  text: string;

  // Injected by caller — empty arrays when not yet available from DB
  memories?: SyncoMemory[];
  lifeRules?: LifeRule[];
  currentSignals?: Record<string, unknown>;

  // Task context (populated after task creation succeeds)
  relatedTaskId?: string;
  relatedTaskTitle?: string;

  // Enable full diagnostics output (dev/debug only)
  devMode?: boolean;
}

export interface OpenQuestionCreated {
  questionText: string;
  questionType: string;
  relatedEntityName?: string;
  persisted: boolean;
  persistError?: string;
}

export interface BrainPipelineResult {
  // Always present
  ok: boolean;
  inputContext: AnalyzedInputContext | null;
  openQuestionsCreated: OpenQuestionCreated[];
  decisionResult: SupportedDecision | null;

  // Transparency: what data was real vs unavailable
  dataAvailability: {
    memoriesAvailable: boolean;
    lifeRulesAvailable: boolean;
    qdrantAvailable: false;      // not connected yet — always false
    postgresMemoriesAvailable: false; // memories injected by caller, not fetched
  };

  // Dev mode only
  diagnostics?: {
    patterns: SyncoPattern[];
    hypotheses: CausalHypothesis[];
    predictions: PredictionRisk[];
    inputContextDiagnostics: string[];
    dataAvailabilityNotes: string[];
  };

  // Set if pipeline itself threw an error (task creation continues regardless)
  pipelineError?: string;
}

// ─── Safe fallback ────────────────────────────────────────────────────────────

function safeFallback(error: unknown): BrainPipelineResult {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    inputContext: null,
    openQuestionsCreated: [],
    decisionResult: null,
    dataAvailability: {
      memoriesAvailable: false,
      lifeRulesAvailable: false,
      qdrantAvailable: false,
      postgresMemoriesAvailable: false,
    },
    pipelineError: msg,
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runBrainPipeline(
  input: BrainPipelineInput
): Promise<BrainPipelineResult> {
  try {
    const memories = input.memories ?? [];
    const lifeRules = input.lifeRules ?? [];
    const currentSignals = input.currentSignals ?? {};

    const memoriesAvailable = memories.length > 0;
    const lifeRulesAvailable = lifeRules.length > 0;

    // ── Step 1: analyze input context ──────────────────────────────────────
    const inputContext = analyzeInputContext(input.text);

    // ── Step 2: generate open questions ───────────────────────────────────
    const suggestedQuestions = generateOpenQuestionsFromContext(inputContext);

    // ── Step 3: persist open questions fire-and-forget ────────────────────
    const openQuestionsCreated: OpenQuestionCreated[] = [];

    if (suggestedQuestions.length > 0) {
      const questionTexts = suggestedQuestions.map(q => q.questionText);

      const persistResult = await persistDeferredQuestions({
        userId: input.userId,
        questions: questionTexts,
        sourceInputText: input.text.slice(0, 100),
        sourceInputRoute: 'quick_brain_pipeline',
        relatedTaskId: input.relatedTaskId,
        relatedTaskTitle: input.relatedTaskTitle,
        generationReason: 'Brain pipeline: inputContextAnalyzer detected unknown entity or ambiguous reference',
      }).then(() => ({ ok: true, error: undefined }))
        .catch((e: unknown) => ({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }));

      for (const q of suggestedQuestions) {
        openQuestionsCreated.push({
          questionText: q.questionText,
          questionType: q.questionType,
          relatedEntityName: q.relatedEntityName,
          persisted: persistResult.ok,
          persistError: persistResult.error,
        });
      }

      if (!persistResult.ok) {
        console.warn('[BrainPipeline] persistDeferredQuestions failed:', persistResult.error);
      }
    }

    // ── Step 4: thinking layer (patterns/hypotheses/predictions) ──────────
    let patterns: SyncoPattern[] = [];
    let hypotheses: CausalHypothesis[] = [];
    let predictions: PredictionRisk[] = [];

    if (memoriesAvailable) {
      const thinkingResult = runSyncoThinkingLayer({
        userId: input.userId,
        memories,
        currentSignals,
        lifeRules,
      });
      patterns = thinkingResult.patterns;
      hypotheses = thinkingResult.hypotheses;
      predictions = thinkingResult.predictions;
    }

    // ── Step 5: decision support ───────────────────────────────────────────
    let decisionResult: SupportedDecision | null = null;

    if (lifeRulesAvailable || memoriesAvailable) {
      const hour = new Date().getHours();
      const decisionCandidate: DecisionCandidate = {
        decisionId: `quick-${Date.now()}`,
        userId: input.userId,
        title: input.text.slice(0, 80),
        metadata: { hour, source: 'quick_input' },
      };

      const decisionCtx: DecisionContext = {
        userId: input.userId,
        decision: decisionCandidate,
        activePatterns: patterns,
        activeHypotheses: hypotheses,
        activePredictions: predictions,
        lifeRules,
        currentSignals,
      };

      decisionResult = evaluateDecision(decisionCtx);
    }

    // ── Step 6: build result ───────────────────────────────────────────────
    const dataAvailabilityNotes: string[] = [
      memoriesAvailable
        ? `memories: ${memories.length} injected by caller (real)`
        : 'memories: none available — patterns/hypotheses/predictions skipped',
      lifeRulesAvailable
        ? `life_rules: ${lifeRules.length} injected by caller (real)`
        : 'life_rules: none available — decision evaluated without rules',
      'qdrant: not connected in pipeline — no vector memory read',
      'postgres_memories: not fetched in pipeline — injected by caller only',
    ];

    const result: BrainPipelineResult = {
      ok: true,
      inputContext,
      openQuestionsCreated,
      decisionResult,
      dataAvailability: {
        memoriesAvailable,
        lifeRulesAvailable,
        qdrantAvailable: false,
        postgresMemoriesAvailable: false,
      },
    };

    if (input.devMode) {
      result.diagnostics = {
        patterns,
        hypotheses,
        predictions,
        inputContextDiagnostics: inputContext.diagnostics,
        dataAvailabilityNotes,
      };
    }

    return result;
  } catch (err: unknown) {
    console.error('[BrainPipeline] unexpected error:', err instanceof Error ? err.message : String(err));
    return safeFallback(err);
  }
}
