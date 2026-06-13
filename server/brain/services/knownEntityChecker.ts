/**
 * Synco Known Entity Checker — Phase 11
 *
 * Checks whether extracted entity names are already known to the Continuous Brain
 * (GraphNode or WikiEntry in Postgres). Used by /quick to suppress redundant
 * open questions when a person is already in System C.
 *
 * Design: fail-open. If Postgres is unavailable all entities are treated as unknown.
 * Never throws — callers can safely catch(() => new Map()).
 */

import { prisma } from '../../lib/prisma.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnownEntityResult {
  name:    string;
  isKnown: boolean;
  source:  'graph_node' | 'wiki_entry' | 'none';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Checks a list of entity names against System C Postgres stores.
 * Returns a Map<originalName, KnownEntityResult> for every input name.
 *
 * Matching is case-insensitive.
 * Checks GraphNode (nodeType = 'person') first, then WikiEntry (topic).
 * Short-circuits per name once a match is found.
 */
export async function checkKnownEntities(
  userId:      string,
  entityNames: string[],
): Promise<Map<string, KnownEntityResult>> {
  const result = new Map<string, KnownEntityResult>();
  if (!userId || entityNames.length === 0) return result;

  // Init all as unknown
  for (const name of entityNames) {
    result.set(name, { name, isKnown: false, source: 'none' });
  }

  const lowerNames = entityNames.map(n => n.toLowerCase());

  // ── 1. Check GraphNode (person) ───────────────────────────────────────────
  // Uses @@index([userId, nodeType]) — efficient.
  const graphNodes = await prisma.graphNode.findMany({
    where: { userId, nodeType: 'person' },
    select: { label: true },
  });

  for (const node of graphNodes) {
    const idx = lowerNames.indexOf(node.label.toLowerCase());
    if (idx !== -1) {
      const original = entityNames[idx];
      result.set(original, { name: original, isKnown: true, source: 'graph_node' });
    }
  }

  // ── 2. Check WikiEntry for remaining unknowns ─────────────────────────────
  // Uses @@index([userId]) — acceptable for small wiki stores.
  const unknownNames = entityNames.filter(n => !result.get(n)?.isKnown);
  if (unknownNames.length > 0) {
    const lowerUnknown = unknownNames.map(n => n.toLowerCase());

    const wikiEntries = await prisma.wikiEntry.findMany({
      where: { userId },
      select: { topic: true },
    });

    for (const entry of wikiEntries) {
      const idx = lowerUnknown.indexOf(entry.topic.toLowerCase());
      if (idx !== -1) {
        const original = unknownNames[idx];
        result.set(original, { name: original, isKnown: true, source: 'wiki_entry' });
      }
    }
  }

  return result;
}
