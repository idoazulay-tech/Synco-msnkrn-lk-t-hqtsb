/**
 * Synco Knowledge Graph Store — Phase 9
 *
 * Persistence layer for GraphNode and GraphEdge Prisma models.
 * Implements upsert logic to avoid duplicate nodes and edges.
 *
 * Upsert rules for nodes:
 * - Match by userId + nodeType + label (unique constraint)
 * - Create if missing, update confidence/metadata if exists
 *
 * Upsert rules for edges:
 * - Match by userId + fromNodeId + toNodeId + relationType (unique constraint)
 * - Create if missing, merge evidenceSignalIds if exists
 *
 * Node resolution: edges reference nodes by label — we resolve to IDs during upsert.
 */

import { prisma } from '../../lib/prisma.js';
import type { GraphUpdateCandidate, NodeToCreate, EdgeToCreate } from '../types/knowledgeGraph.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertGraphResult {
  ok:             boolean;
  nodesCreated:   number;
  nodesUpdated:   number;
  edgesCreated:   number;
  edgesUpdated:   number;
  error?:         string;
}

export interface GraphNodeRow {
  id:               string;
  userId:           string;
  nodeType:         string;
  label:            string;
  confidence:       number;
  sensitivityLevel: string;
  metadata:         unknown;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface GraphEdgeRow {
  id:                string;
  userId:            string;
  fromNodeId:        string;
  toNodeId:          string;
  relationType:      string;
  confidence:        number;
  evidenceSignalIds: unknown;
  createdAt:         Date;
  updatedAt:         Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function mergeSignalIds(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const id of incoming) {
    if (!seen.has(id)) { merged.push(id); seen.add(id); }
  }
  return merged;
}

// ─── Upsert nodes ─────────────────────────────────────────────────────────────

async function upsertNode(
  userId: string,
  node: NodeToCreate,
): Promise<{ id: string; created: boolean }> {
  // Prisma upsert with unique constraint [userId, nodeType, label]
  const result = await prisma.graphNode.upsert({
    where:  { userId_nodeType_label: { userId, nodeType: node.nodeType, label: node.label } },
    create: {
      userId,
      nodeType:         node.nodeType,
      label:            node.label,
      confidence:       node.confidence,
      metadata:         node.metadata ? (node.metadata as object) : null,
    },
    update: {
      // Blend confidence upward slightly when we see it again
      confidence: Math.min(1, node.confidence + 0.05),
      metadata:   node.metadata ? (node.metadata as object) : undefined,
    },
  });
  return { id: result.id, created: result.createdAt.getTime() === result.updatedAt.getTime() };
}

// ─── Upsert graph candidates ──────────────────────────────────────────────────

export async function upsertGraphUpdateCandidates(
  userId: string,
  candidates: GraphUpdateCandidate[],
): Promise<UpsertGraphResult> {
  let nodesCreated = 0;
  let nodesUpdated = 0;
  let edgesCreated = 0;
  let edgesUpdated = 0;
  const errors: string[] = [];

  // Build a label→id cache for this upsert run
  const nodeIdCache = new Map<string, string>(); // normalizedKey → db id

  // ── Upsert all nodes first ─────────────────────────────────────────────────
  for (const candidate of candidates) {
    for (const node of candidate.nodesToCreate) {
      try {
        const { id, created } = await upsertNode(userId, node);
        const cacheKey = `${node.nodeType}:${normalizeLabel(node.label)}`;
        nodeIdCache.set(cacheKey, id);
        if (created) nodesCreated++; else nodesUpdated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[graphStore] upsertNode failed:', msg, '|', node.label);
        errors.push(`node:${node.label}: ${msg}`);
      }
    }

    // Handle nodesToUpdate
    for (const upd of candidate.nodesToUpdate) {
      try {
        const cacheKey = `${upd.nodeType}:${normalizeLabel(upd.label)}`;
        await prisma.graphNode.updateMany({
          where: { userId, nodeType: upd.nodeType, label: upd.label },
          data:  {
            confidence: Math.min(1, upd.confidence + 0.05),
            metadata:   upd.metadata ? (upd.metadata as object) : undefined,
          },
        });
        nodesUpdated++;
        // Fetch id for edge resolution
        const found = await prisma.graphNode.findUnique({
          where: { userId_nodeType_label: { userId, nodeType: upd.nodeType, label: upd.label } },
        });
        if (found) nodeIdCache.set(cacheKey, found.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`nodeUpdate:${upd.label}: ${msg}`);
      }
    }
  }

  // ── Upsert edges (requires resolved node IDs) ──────────────────────────────
  for (const candidate of candidates) {
    for (const edge of candidate.edgesToCreate) {
      try {
        // Resolve from/to node IDs — look in cache or query DB
        const fromKey = normalizeLabel(edge.fromLabel);
        const toKey   = normalizeLabel(edge.toLabel);

        let fromId = nodeIdCache.get(`person:${fromKey}`) ??
                     nodeIdCache.get(`topic:${fromKey}`) ??
                     nodeIdCache.get(`project:${fromKey}`);
        let toId   = nodeIdCache.get(`person:${toKey}`) ??
                     nodeIdCache.get(`topic:${toKey}`) ??
                     nodeIdCache.get(`project:${toKey}`) ??
                     nodeIdCache.get(`financial_issue:${toKey}`);

        // Fallback: search DB by label (any nodeType)
        if (!fromId) {
          const found = await prisma.graphNode.findFirst({
            where: { userId, label: { equals: edge.fromLabel } },
          });
          if (found) { fromId = found.id; }
        }
        if (!toId) {
          const found = await prisma.graphNode.findFirst({
            where: { userId, label: { equals: edge.toLabel } },
          });
          if (found) { toId = found.id; }
        }

        if (!fromId || !toId) {
          errors.push(`edge: could not resolve nodes for "${edge.fromLabel}" → "${edge.toLabel}"`);
          continue;
        }

        // Upsert edge
        const existing = await prisma.graphEdge.findUnique({
          where: {
            userId_fromNodeId_toNodeId_relationType: {
              userId, fromNodeId: fromId, toNodeId: toId, relationType: edge.relationType,
            },
          },
        });

        if (!existing) {
          await prisma.graphEdge.create({
            data: {
              userId,
              fromNodeId:        fromId,
              toNodeId:          toId,
              relationType:      edge.relationType,
              confidence:        edge.confidence,
              evidenceSignalIds: edge.evidenceSignalIds,
            },
          });
          edgesCreated++;
        } else {
          const merged = mergeSignalIds(
            Array.isArray(existing.evidenceSignalIds) ? (existing.evidenceSignalIds as string[]) : [],
            edge.evidenceSignalIds,
          );
          await prisma.graphEdge.update({
            where: { id: existing.id },
            data:  {
              evidenceSignalIds: merged,
              confidence: Math.min(1, existing.confidence + 0.03),
            },
          });
          edgesUpdated++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[graphStore] upsertEdge failed:', msg);
        errors.push(`edge ${edge.fromLabel}→${edge.toLabel}: ${msg}`);
      }
    }
  }

  return {
    ok:           errors.length === 0,
    nodesCreated,
    nodesUpdated,
    edgesCreated,
    edgesUpdated,
    error:        errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listGraphNodesForUser(userId: string, limit = 100): Promise<GraphNodeRow[]> {
  try {
    return await prisma.graphNode.findMany({
      where:   { userId },
      orderBy: { updatedAt: 'desc' },
      take:    limit,
    }) as GraphNodeRow[];
  } catch (err: unknown) {
    console.error('[graphStore] listGraphNodesForUser failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function listGraphEdgesForUser(userId: string, limit = 200): Promise<GraphEdgeRow[]> {
  try {
    return await prisma.graphEdge.findMany({
      where:   { userId },
      orderBy: { updatedAt: 'desc' },
      take:    limit,
    }) as GraphEdgeRow[];
  } catch (err: unknown) {
    console.error('[graphStore] listGraphEdgesForUser failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
