/**
 * Synco Persist-from-Routing-Plan Bridge — Phase 9
 *
 * Connects RoutedMemoryPlan + MeaningEngineResult to persistence services.
 * This is the "last mile" of the pipeline — writes all derived data to DB.
 *
 * Persistence order:
 *   1. RawCaptureEvent (already saved before this is called — id injected)
 *   2. BrainSignals
 *   3. OpenQuestions (via existing openQuestions service)
 *   4. WikiEntry upserts
 *   5. GraphNode + GraphEdge upserts
 *
 * Routed episodic/behavioral/knowledge/preference/commitment memories:
 *   → NOT persisted in Phase 9 (planned only)
 *   → diagnostics will clearly say: routedMemoryPersistence: planned_only
 *
 * Partial failure handling:
 *   - Each step is independent
 *   - One step failing does not block the rest
 *   - All errors are collected and returned in the result
 */

import { saveSignals, type SaveSignalsResult }          from './signalStore.js';
import { upsertWikiUpdateCandidates, type UpsertWikiResult } from './personalWikiStore.js';
import { upsertGraphUpdateCandidates, type UpsertGraphResult } from './knowledgeGraphStore.js';
import { persistDeferredQuestions }                     from './openQuestions.js';
import type { Signal }                                  from '../types/signal.js';
import type { WikiUpdateCandidate }                     from '../types/personalWiki.js';
import type { GraphUpdateCandidate }                    from '../types/knowledgeGraph.js';
import type { OpenQuestionSuggestion }                  from './meaningEngine.js';

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface PersistPlanInput {
  userId:                string;
  rawEventDbId?:         string;        // DB id of saved RawCaptureEvent
  rawInputText?:         string;        // for OpenQuestion source context
  signals:               Signal[];
  openQuestions:         OpenQuestionSuggestion[];
  wikiUpdateCandidates:  WikiUpdateCandidate[];
  graphUpdateCandidates: GraphUpdateCandidate[];
}

export interface PersistPlanResult {
  ok:                  boolean;
  signalsResult:       SaveSignalsResult;
  wikiResult:          UpsertWikiResult;
  graphResult:         UpsertGraphResult;
  openQuestionsSaved:  number;
  openQuestionsError?: string;
  persistedCounts: {
    signals:     number;
    wikiUpdates: number;
    graphNodes:  number;
    graphEdges:  number;
    openQuestions: number;
  };
  diagnostics: string[];
  partialFailure: boolean;
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

export async function persistFromRoutingPlan(input: PersistPlanInput): Promise<PersistPlanResult> {
  const diagnostics: string[] = [
    'routedMemoryPersistence: planned_only (episodic/behavioral/knowledge/preference/commitment)',
  ];

  // ── Step 1: Save Signals ──────────────────────────────────────────────────
  const signalsResult = await saveSignals(input.signals, input.rawEventDbId);
  diagnostics.push(
    signalsResult.ok
      ? `signals: saved ${signalsResult.savedCount}`
      : `signals: partial failure — ${signalsResult.error}`,
  );

  // ── Step 2: Persist Open Questions ────────────────────────────────────────
  let openQuestionsSaved  = 0;
  let openQuestionsError: string | undefined;

  const questionsToAsk = input.openQuestions.filter(q => q.questionText.trim().length > 0);
  if (questionsToAsk.length > 0) {
    try {
      await persistDeferredQuestions({
        userId:           input.userId,
        questions:        questionsToAsk.map(q => q.questionText),
        sourceInputText:  (input.rawInputText ?? '').slice(0, 100),
        sourceInputRoute: 'brain_share_pipeline',
      });
      openQuestionsSaved = questionsToAsk.length;
      diagnostics.push(`open_questions: saved ${openQuestionsSaved}`);
    } catch (err: unknown) {
      openQuestionsError = err instanceof Error ? err.message : String(err);
      console.error('[persistBridge] openQuestions failed:', openQuestionsError);
      diagnostics.push(`open_questions: failed — ${openQuestionsError}`);
    }
  } else {
    diagnostics.push('open_questions: none to save');
  }

  // ── Step 3: Wiki upserts ──────────────────────────────────────────────────
  const wikiResult = input.wikiUpdateCandidates.length > 0
    ? await upsertWikiUpdateCandidates(input.userId, input.wikiUpdateCandidates)
    : { ok: true, upsertedCount: 0, createdTopics: [], updatedTopics: [] };

  diagnostics.push(
    wikiResult.ok
      ? `wiki: ${wikiResult.upsertedCount} upserted (${wikiResult.createdTopics.length} created, ${wikiResult.updatedTopics.length} updated)`
      : `wiki: partial failure — ${wikiResult.error}`,
  );

  // ── Step 4: Graph upserts ─────────────────────────────────────────────────
  const graphResult = input.graphUpdateCandidates.length > 0
    ? await upsertGraphUpdateCandidates(input.userId, input.graphUpdateCandidates)
    : { ok: true, nodesCreated: 0, nodesUpdated: 0, edgesCreated: 0, edgesUpdated: 0 };

  diagnostics.push(
    graphResult.ok
      ? `graph: ${graphResult.nodesCreated}n+ ${graphResult.nodesUpdated}n~ / ${graphResult.edgesCreated}e+ ${graphResult.edgesUpdated}e~`
      : `graph: partial failure — ${graphResult.error}`,
  );

  const partialFailure =
    !signalsResult.ok || !wikiResult.ok || !graphResult.ok || !!openQuestionsError;

  return {
    ok: !partialFailure,
    signalsResult,
    wikiResult,
    graphResult,
    openQuestionsSaved,
    openQuestionsError,
    persistedCounts: {
      signals:       signalsResult.savedCount,
      wikiUpdates:   wikiResult.upsertedCount,
      graphNodes:    graphResult.nodesCreated + graphResult.nodesUpdated,
      graphEdges:    graphResult.edgesCreated + graphResult.edgesUpdated,
      openQuestions: openQuestionsSaved,
    },
    diagnostics,
    partialFailure,
  };
}
