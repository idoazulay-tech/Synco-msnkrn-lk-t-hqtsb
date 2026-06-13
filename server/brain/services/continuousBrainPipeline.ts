/**
 * Synco Continuous Brain Pipeline — Phase 8
 *
 * High-level orchestrator for the new capture→meaning→memory flow.
 * Runs PARALLEL to the existing quick brainPipeline — does NOT replace it.
 *
 * Existing flow (untouched):
 *   /quick → brainPipeline → inputContextAnalyzer → decisionSupport → recommendation
 *
 * New flow (Phase 8):
 *   RawEvent → MeaningEngine → Signal[] → MemoryRouter → RoutedMemoryPlan
 *            → WikiUpdateCandidates + GraphUpdateCandidates + OpenQuestions
 *
 * Design constraints:
 * - Pure orchestration — no DB writes in Phase 8
 * - Never throws — all errors produce safe fallback
 * - Does not connect Qdrant / external sources
 * - knownEntities, existingWikiTopics, existingGraphNodes are all optional hints
 */

import { createRawEvent, type RawEvent, type RawEventSourceType } from '../types/rawEvent.js';
import { runMeaningEngine, type MeaningEngineResult } from './meaningEngine.js';
import { routeSignalsToMemory, type RoutedMemoryPlan } from './memoryRouter.js';
import type { Signal } from '../types/signal.js';
import type { WikiUpdateCandidate } from '../types/personalWiki.js';
import type { GraphUpdateCandidate } from '../types/knowledgeGraph.js';
import type { OpenQuestionSuggestion } from './meaningEngine.js';

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface ContinuousBrainInput {
  userId:               string;
  rawEvent:             RawEvent;

  // Optional context injected by caller for richer planning
  knownEntities?:       string[];       // names the system already knows
  existingWikiTopics?:  string[];       // topics already in the wiki
  existingGraphNodes?:  string[];       // node labels already in the graph
}

export interface ContinuousBrainResult {
  ok:                    boolean;
  rawEventDiagnostics:   string[];
  signals:               Signal[];
  memoryRoutingPlan:     RoutedMemoryPlan | null;
  wikiUpdateCandidates:  WikiUpdateCandidate[];
  graphUpdateCandidates: GraphUpdateCandidate[];
  openQuestions:         OpenQuestionSuggestion[];
  suggestedTasks:        MeaningEngineResult['suggestedTasks'];
  diagnostics:           string[];
  pipelineError?:        string;
}

// ─── Safe fallback ────────────────────────────────────────────────────────────

function safeFallback(error: unknown): ContinuousBrainResult {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    ok:                    false,
    rawEventDiagnostics:   [],
    signals:               [],
    memoryRoutingPlan:     null,
    wikiUpdateCandidates:  [],
    graphUpdateCandidates: [],
    openQuestions:         [],
    suggestedTasks:        [],
    diagnostics:           [`pipeline_error: ${msg}`],
    pipelineError:         msg,
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export function runContinuousBrainFoundation(input: ContinuousBrainInput): ContinuousBrainResult {
  try {
    const diagnostics: string[] = [];
    diagnostics.push(`continuous_brain: userId=${input.userId}`);
    diagnostics.push(`source: ${input.rawEvent.sourceType}, contentType: ${input.rawEvent.contentType}`);
    diagnostics.push(`privacy: ${input.rawEvent.privacy.sensitivityLevel}, retention: ${input.rawEvent.privacy.retentionPolicy}`);

    // ── Step 1: MeaningEngine ─────────────────────────────────────────────────
    const meaningResult = runMeaningEngine(input.rawEvent);
    diagnostics.push(...meaningResult.diagnostics.map(d => `[meaning] ${d}`));

    // ── Step 2: Mark known entities ───────────────────────────────────────────
    // If caller injected known entities, mark isKnown=true on matching signal entities
    let signals = meaningResult.signals;
    if (input.knownEntities && input.knownEntities.length > 0) {
      const knownSet = new Set(input.knownEntities.map(e => e.toLowerCase()));
      signals = signals.map(sig => ({
        ...sig,
        relatedEntities: sig.relatedEntities.map(entity => ({
          ...entity,
          isKnown: knownSet.has(entity.name.toLowerCase()) ? true : entity.isKnown,
        })),
        // Suppress open question for known entities — handled below
        shouldCreateOpenQuestion: sig.relatedEntities.some(e => !knownSet.has(e.name.toLowerCase()))
          ? sig.shouldCreateOpenQuestion
          : false,
      }));
      diagnostics.push(`known entities applied: ${input.knownEntities.join(', ')}`);
    }

    // Filter open questions — suppress if entity is now known
    const knownSet = new Set((input.knownEntities ?? []).map(e => e.toLowerCase()));
    const filteredOpenQuestions = meaningResult.openQuestions.filter(q =>
      !q.relatedEntityName || !knownSet.has(q.relatedEntityName.toLowerCase()),
    );
    if (filteredOpenQuestions.length < meaningResult.openQuestions.length) {
      diagnostics.push(`suppressed ${meaningResult.openQuestions.length - filteredOpenQuestions.length} open questions for known entities`);
    }

    // ── Step 3: MemoryRouter ──────────────────────────────────────────────────
    const routingPlan = routeSignalsToMemory({
      signals,
      openQuestions:  filteredOpenQuestions,
      wikiHints:      meaningResult.wikiUpdateHints,
      graphHints:     meaningResult.graphUpdateHints,
    });
    diagnostics.push(...routingPlan.diagnostics.map(d => `[router] ${d}`));

    // ── Step 4: Summary ────────────────────────────────────────────────────────
    diagnostics.push(
      `result: ${signals.length} signals, ${filteredOpenQuestions.length} open_q, ` +
      `${routingPlan.wikiUpdateCandidates.length} wiki_candidates, ` +
      `${routingPlan.graphUpdateCandidates.length} graph_candidates`,
    );

    return {
      ok:                    true,
      rawEventDiagnostics:   meaningResult.diagnostics,
      signals,
      memoryRoutingPlan:     routingPlan,
      wikiUpdateCandidates:  routingPlan.wikiUpdateCandidates,
      graphUpdateCandidates: routingPlan.graphUpdateCandidates,
      openQuestions:         filteredOpenQuestions,
      suggestedTasks:        meaningResult.suggestedTasks,
      diagnostics,
    };
  } catch (err: unknown) {
    console.error('[ContinuousBrainPipeline] unexpected error:', err instanceof Error ? err.message : String(err));
    return safeFallback(err);
  }
}

// ─── Convenience: create + run from raw text ──────────────────────────────────

export function runContinuousBrainFromText(
  userId: string,
  text: string,
  sourceType: RawEventSourceType = 'quick_input',
  opts: Omit<ContinuousBrainInput, 'userId' | 'rawEvent'> = {},
): ContinuousBrainResult {
  const rawEvent = createRawEvent(userId, text, sourceType);
  return runContinuousBrainFoundation({ userId, rawEvent, ...opts });
}
