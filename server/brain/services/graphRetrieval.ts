/**
 * Synco Graph Retrieval — Phase 10
 *
 * Search GraphNode and GraphEdge records, and assemble local graph context.
 * All search is label/type based — no vector/semantic yet.
 *
 * Functions:
 *   findGraphNodesByLabel    — exact + fuzzy label match
 *   findGraphNodesByType     — filter by nodeType
 *   getGraphContextForNode   — node + all edges (in/out) + connected node labels
 *   getGraphContextForLabel  — label → node → context (convenience)
 */

import { prisma } from '../../lib/prisma.js';
import type { GraphNodeRow, GraphEdgeRow } from './knowledgeGraphStore.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectedEdge {
  edgeId:        string;
  relationType:  string;
  confidence:    number;
  direction:     'outgoing' | 'incoming';
  otherNodeId:   string;
  otherNodeLabel: string;
  otherNodeType:  string;
}

export interface GraphContextResult {
  ok:             boolean;
  node:           GraphNodeRow | null;
  outgoingEdges:  ConnectedEdge[];
  incomingEdges:  ConnectedEdge[];
  allEdges:       ConnectedEdge[];
  connectedLabels: string[];
  error?:         string;
}

export interface GraphNodeSearchResult {
  ok:     boolean;
  nodes:  GraphNodeRow[];
  source: 'exact_label' | 'fuzzy_label' | 'by_type' | 'empty';
  error?: string;
}

// ─── Find by label ────────────────────────────────────────────────────────────

export async function findGraphNodesByLabel(
  userId: string,
  label:  string,
  limit = 20,
): Promise<GraphNodeSearchResult> {
  try {
    // Exact match first (case-insensitive)
    const exact = await prisma.graphNode.findMany({
      where:   { userId, label: { equals: label, mode: 'insensitive' } },
      orderBy: { confidence: 'desc' },
      take:    limit,
    });
    if (exact.length > 0) {
      return { ok: true, nodes: exact as GraphNodeRow[], source: 'exact_label' };
    }

    // Fuzzy contains
    const fuzzy = await prisma.graphNode.findMany({
      where:   { userId, label: { contains: label, mode: 'insensitive' } },
      orderBy: { confidence: 'desc' },
      take:    limit,
    });
    return {
      ok:     true,
      nodes:  fuzzy as GraphNodeRow[],
      source: fuzzy.length > 0 ? 'fuzzy_label' : 'empty',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[graphRetrieval] findGraphNodesByLabel failed:', msg);
    return { ok: false, nodes: [], source: 'empty', error: msg };
  }
}

// ─── Find by type ─────────────────────────────────────────────────────────────

export async function findGraphNodesByType(
  userId:   string,
  nodeType: string,
  limit = 20,
): Promise<GraphNodeSearchResult> {
  try {
    const nodes = await prisma.graphNode.findMany({
      where:   { userId, nodeType },
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
      take:    limit,
    });
    return { ok: true, nodes: nodes as GraphNodeRow[], source: 'by_type' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[graphRetrieval] findGraphNodesByType failed:', msg);
    return { ok: false, nodes: [], source: 'empty', error: msg };
  }
}

// ─── Get full context for a node ──────────────────────────────────────────────

export async function getGraphContextForNode(
  userId: string,
  nodeId: string,
): Promise<GraphContextResult> {
  try {
    const node = await prisma.graphNode.findFirst({
      where: { id: nodeId, userId },
    });
    if (!node) {
      return { ok: true, node: null, outgoingEdges: [], incomingEdges: [], allEdges: [], connectedLabels: [] };
    }

    // Fetch edges in both directions with connected node info
    const [outEdges, inEdges] = await Promise.all([
      prisma.graphEdge.findMany({
        where:   { fromNodeId: nodeId, userId },
        include: { toNode: true },
        orderBy: { confidence: 'desc' },
        take:    50,
      }),
      prisma.graphEdge.findMany({
        where:   { toNodeId: nodeId, userId },
        include: { fromNode: true },
        orderBy: { confidence: 'desc' },
        take:    50,
      }),
    ]);

    const outgoing: ConnectedEdge[] = outEdges.map(e => ({
      edgeId:         e.id,
      relationType:   e.relationType,
      confidence:     e.confidence,
      direction:      'outgoing' as const,
      otherNodeId:    e.toNodeId,
      otherNodeLabel: (e as typeof e & { toNode: { label: string; nodeType: string } }).toNode.label,
      otherNodeType:  (e as typeof e & { toNode: { label: string; nodeType: string } }).toNode.nodeType,
    }));

    const incoming: ConnectedEdge[] = inEdges.map(e => ({
      edgeId:         e.id,
      relationType:   e.relationType,
      confidence:     e.confidence,
      direction:      'incoming' as const,
      otherNodeId:    e.fromNodeId,
      otherNodeLabel: (e as typeof e & { fromNode: { label: string; nodeType: string } }).fromNode.label,
      otherNodeType:  (e as typeof e & { fromNode: { label: string; nodeType: string } }).fromNode.nodeType,
    }));

    const allEdges    = [...outgoing, ...incoming];
    const connectedLabels = [...new Set(allEdges.map(e => e.otherNodeLabel))];

    return {
      ok:             true,
      node:           node as GraphNodeRow,
      outgoingEdges:  outgoing,
      incomingEdges:  incoming,
      allEdges,
      connectedLabels,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[graphRetrieval] getGraphContextForNode failed:', msg);
    return { ok: false, node: null, outgoingEdges: [], incomingEdges: [], allEdges: [], connectedLabels: [], error: msg };
  }
}

// ─── Get context by label (convenience) ──────────────────────────────────────

export async function getGraphContextForLabel(
  userId: string,
  label:  string,
): Promise<GraphContextResult> {
  try {
    const searchResult = await findGraphNodesByLabel(userId, label, 1);
    if (!searchResult.ok || searchResult.nodes.length === 0) {
      return { ok: true, node: null, outgoingEdges: [], incomingEdges: [], allEdges: [], connectedLabels: [] };
    }
    return getGraphContextForNode(userId, searchResult.nodes[0].id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, node: null, outgoingEdges: [], incomingEdges: [], allEdges: [], connectedLabels: [], error: msg };
  }
}
