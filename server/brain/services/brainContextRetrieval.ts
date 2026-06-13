/**
 * Synco Brain Context Retrieval — Phase 10
 *
 * Main retrieval entry point. Given a userId + query string,
 * runs wiki / signal / graph searches in parallel and assembles
 * a unified BrainContextResult.
 *
 * What it does:
 *   1. Wiki search (topic → text fallback)
 *   2. Signal search (entity + text combined)
 *   3. Graph node search (label)
 *   4. Graph context for best matching node
 *
 * What it does NOT do (yet):
 *   - Semantic / vector search (no Qdrant)
 *   - Cross-user retrieval
 *   - Temporal filtering
 *
 * All DB errors are caught; result degrades gracefully.
 */

import { getWikiEntriesForQuery }    from './wikiRetrieval.js';
import { getSignalsForQuery }        from './signalRetrieval.js';
import { findGraphNodesByLabel, getGraphContextForNode } from './graphRetrieval.js';
import type { WikiEntryRow }         from './personalWikiStore.js';
import type { StoredSignal }         from './signalStore.js';
import type { GraphNodeRow }         from './knowledgeGraphStore.js';
import type { GraphContextResult }   from './graphRetrieval.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainContextResult {
  ok:             boolean;
  query:          string;
  userId:         string;
  wikiEntries:    WikiEntryRow[];
  signals:        StoredSignal[];
  graphNodes:     GraphNodeRow[];
  graphContext:   GraphContextResult | null;
  summary:        string;          // Hebrew 1-liner about what was found
  diagnostics:    string[];        // internal: which sources returned data
  sources:        string[];        // human-readable: "wiki", "signals", "graph"
  error?:         string;
}

// ─── Hebrew summary builder ───────────────────────────────────────────────────

function buildHebrewSummary(
  query:       string,
  wikiCount:   number,
  signalCount: number,
  graphCount:  number,
  edgeCount:   number,
): string {
  const parts: string[] = [];

  if (wikiCount > 0) {
    parts.push(`${wikiCount} ערך${wikiCount === 1 ? '' : 'ים'} בויקי`);
  }
  if (signalCount > 0) {
    parts.push(`${signalCount} אות${signalCount === 1 ? '' : 'ות'}`);
  }
  if (graphCount > 0 && edgeCount > 0) {
    parts.push(`${graphCount} צמת${graphCount === 1 ? '' : 'ים'} ו-${edgeCount} קש${edgeCount === 1 ? 'ר' : 'רים'} בגרף`);
  } else if (graphCount > 0) {
    parts.push(`${graphCount} פריט${graphCount === 1 ? '' : 'ים'} בגרף האישי`);
  }

  if (parts.length === 0) {
    return `לא נמצא מידע שמור על "${query}".`;
  }
  return `נמצא על "${query}": ${parts.join(', ')}.`;
}

// ─── Main retrieval ───────────────────────────────────────────────────────────

export async function retrieveContinuousBrainContext(
  userId: string,
  query:  string,
): Promise<BrainContextResult> {
  const diagnostics: string[] = [];
  const sources:     string[] = [];

  if (!query || query.trim().length === 0) {
    return {
      ok: false, query, userId,
      wikiEntries: [], signals: [], graphNodes: [], graphContext: null,
      summary: 'שאילתה ריקה.', diagnostics: ['query: empty'], sources: [],
      error: 'empty query',
    };
  }

  const q = query.trim();

  // ── Run wiki + signal + graph node searches in parallel ───────────────────
  const [wikiResult, signalResult, graphNodeResult] = await Promise.all([
    getWikiEntriesForQuery(userId, q, 10),
    getSignalsForQuery(userId, q, 20),
    findGraphNodesByLabel(userId, q, 10),
  ]);

  // ── Diagnostics ───────────────────────────────────────────────────────────
  diagnostics.push(`wiki: ${wikiResult.entries.length} entries (source: ${wikiResult.source})`);
  diagnostics.push(`signals: ${signalResult.signals.length} signals (source: ${signalResult.source})`);
  diagnostics.push(`graph_nodes: ${graphNodeResult.nodes.length} nodes (source: ${graphNodeResult.source})`);

  if (wikiResult.entries.length > 0)     sources.push('wiki');
  if (signalResult.signals.length > 0)   sources.push('signals');
  if (graphNodeResult.nodes.length > 0)  sources.push('graph');

  // ── Graph context for best node ───────────────────────────────────────────
  let graphContext: GraphContextResult | null = null;
  if (graphNodeResult.ok && graphNodeResult.nodes.length > 0) {
    const bestNode = graphNodeResult.nodes[0];
    graphContext = await getGraphContextForNode(userId, bestNode.id);
    diagnostics.push(
      graphContext.ok
        ? `graph_context: ${graphContext.allEdges.length} edges for "${bestNode.label}"`
        : `graph_context: failed — ${graphContext.error}`,
    );
  } else {
    diagnostics.push('graph_context: no node found — skipped');
  }

  const edgeCount = graphContext?.allEdges.length ?? 0;

  const summary = buildHebrewSummary(
    q,
    wikiResult.entries.length,
    signalResult.signals.length,
    graphNodeResult.nodes.length,
    edgeCount,
  );

  const anyError = !wikiResult.ok || !signalResult.ok || !graphNodeResult.ok
    ? 'one or more sources failed — results may be partial'
    : undefined;

  return {
    ok:           !anyError,
    query:        q,
    userId,
    wikiEntries:  wikiResult.entries,
    signals:      signalResult.signals,
    graphNodes:   graphNodeResult.nodes,
    graphContext,
    summary,
    diagnostics,
    sources,
    error:        anyError,
  };
}
