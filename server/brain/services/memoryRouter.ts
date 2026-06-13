/**
 * Synco Memory Router — Phase 8
 *
 * Takes an array of Signals and routes them into a RoutedMemoryPlan.
 * Pure function — no DB writes in Phase 8. Returns a plan for what SHOULD happen.
 *
 * Memory categories:
 *   episodic   — what happened (events, actions)
 *   behavioral — how the user behaves (patterns, friction)
 *   knowledge  — what the user learned or knows
 *   preference — what matters to the user
 *   commitment — what the user (or others) promised
 *
 * Pipeline position:
 *   Signal[] → [MemoryRouter] → RoutedMemoryPlan → (future) Memory Persistence
 */

import type { Signal, SuggestedMemoryType } from '../types/signal.js';
import type { WikiUpdateCandidate } from '../types/personalWiki.js';
import type { GraphUpdateCandidate, NodeToCreate, EdgeToCreate } from '../types/knowledgeGraph.js';
import type { OpenQuestionSuggestion } from './meaningEngine.js';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface RoutedMemory {
  memoryType:  SuggestedMemoryType;
  sourceSignal: Signal;
  title:        string;
  summary:      string;
  confidence:   number;
  ownerId:      string;
}

export interface RoutedMemoryPlan {
  episodicMemories:      RoutedMemory[];
  behavioralMemories:    RoutedMemory[];
  knowledgeMemories:     RoutedMemory[];
  preferenceMemories:    RoutedMemory[];
  commitmentMemories:    RoutedMemory[];
  openQuestions:         OpenQuestionSuggestion[];
  wikiUpdateCandidates:  WikiUpdateCandidate[];
  graphUpdateCandidates: GraphUpdateCandidate[];
  diagnostics:           string[];
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface MemoryRouterInput {
  signals:          Signal[];
  openQuestions?:   OpenQuestionSuggestion[];
  wikiHints?:       import('./meaningEngine.js').WikiUpdateHint[];
  graphHints?:      import('./meaningEngine.js').GraphUpdateHint[];
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function routeSignalsToMemory(input: MemoryRouterInput): RoutedMemoryPlan {
  const diagnostics: string[] = [];
  const episodic:    RoutedMemory[] = [];
  const behavioral:  RoutedMemory[] = [];
  const knowledge:   RoutedMemory[] = [];
  const preference:  RoutedMemory[] = [];
  const commitment:  RoutedMemory[] = [];

  for (const signal of input.signals) {
    const mem: RoutedMemory = {
      memoryType:   signal.suggestedMemoryType,
      sourceSignal: signal,
      title:        signal.title,
      summary:      signal.summary,
      confidence:   signal.confidence,
      ownerId:      signal.userId,
    };

    switch (signal.suggestedMemoryType) {
      case 'episodic':    episodic.push(mem);    break;
      case 'behavioral':  behavioral.push(mem);  break;
      case 'knowledge':   knowledge.push(mem);   break;
      case 'preference':  preference.push(mem);  break;
      case 'commitment':  commitment.push(mem);  break;
    }

    diagnostics.push(`signal "${signal.signalType}" → ${signal.suggestedMemoryType} memory`);
  }

  // ── Wiki update candidates ─────────────────────────────────────────────────
  const wikiUpdateCandidates: WikiUpdateCandidate[] = (input.wikiHints ?? []).map(hint => ({
    topic:           hint.topic,
    action:          'update' as const,
    reason:          hint.reason,
    newKeyPoints:    hint.keyPoints,
    confidence:      0.6,
    sourceSignalIds: input.signals
      .filter(s => s.shouldUpdateWiki)
      .map(s => s.signalId),
  }));

  // ── Graph update candidates ────────────────────────────────────────────────
  const nodesToCreate: NodeToCreate[] = (input.graphHints ?? []).map(hint => ({
    nodeType:   hint.nodeType as NodeToCreate['nodeType'],
    label:      hint.label,
    confidence: 0.6,
    fromSignalId: input.signals.find(s => s.shouldUpdateGraph)?.signalId,
  }));

  const edgesToCreate: EdgeToCreate[] = (input.graphHints ?? [])
    .filter(h => h.relation)
    .map(h => ({
      fromLabel:         h.relation!.fromLabel,
      toLabel:           h.label,
      relationType:      h.relation!.relationType as EdgeToCreate['relationType'],
      confidence:        0.55,
      evidenceSignalIds: input.signals.filter(s => s.shouldUpdateGraph).map(s => s.signalId),
    }));

  const graphUpdateCandidates: GraphUpdateCandidate[] = nodesToCreate.length > 0 || edgesToCreate.length > 0
    ? [{
        nodesToCreate,
        edgesToCreate,
        nodesToUpdate: [],
        diagnostics:   [`${nodesToCreate.length} nodes, ${edgesToCreate.length} edges planned`],
      }]
    : [];

  diagnostics.push(
    `routed: ${episodic.length} episodic, ${behavioral.length} behavioral, ` +
    `${knowledge.length} knowledge, ${preference.length} preference, ${commitment.length} commitment`,
  );
  diagnostics.push(
    `wiki candidates: ${wikiUpdateCandidates.length}, graph candidates: ${graphUpdateCandidates.length}`,
  );

  return {
    episodicMemories:      episodic,
    behavioralMemories:    behavioral,
    knowledgeMemories:     knowledge,
    preferenceMemories:    preference,
    commitmentMemories:    commitment,
    openQuestions:         input.openQuestions ?? [],
    wikiUpdateCandidates,
    graphUpdateCandidates,
    diagnostics,
  };
}
