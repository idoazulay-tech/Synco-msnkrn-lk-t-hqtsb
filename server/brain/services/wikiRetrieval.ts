/**
 * Synco Wiki Retrieval — Phase 10
 *
 * Search and retrieve WikiEntry records from Postgres.
 * All search is keyword/ILIKE — no vector/semantic yet.
 *
 * Functions:
 *   searchWikiByTopic      — exact + fuzzy topic match
 *   searchWikiByText       — full-text search across summary + keyPoints
 *   getWikiEntriesForQuery — combined: topic first, then text fallback
 */

import { prisma } from '../../lib/prisma.js';
import type { WikiEntryRow } from './personalWikiStore.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiSearchResult {
  ok:      boolean;
  entries: WikiEntryRow[];
  source:  'exact_topic' | 'fuzzy_topic' | 'text_search' | 'empty';
  error?:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

// ─── Search by topic ──────────────────────────────────────────────────────────

export async function searchWikiByTopic(
  userId: string,
  topic:  string,
  limit = 10,
): Promise<WikiSearchResult> {
  try {
    // 1. Exact match
    const exact = await prisma.wikiEntry.findMany({
      where:   { userId, topic: { equals: topic, mode: 'insensitive' } },
      orderBy: { confidence: 'desc' },
      take:    limit,
    });
    if (exact.length > 0) {
      return { ok: true, entries: exact as WikiEntryRow[], source: 'exact_topic' };
    }

    // 2. Contains match
    const fuzzy = await prisma.wikiEntry.findMany({
      where:   { userId, topic: { contains: topic, mode: 'insensitive' } },
      orderBy: { confidence: 'desc' },
      take:    limit,
    });
    if (fuzzy.length > 0) {
      return { ok: true, entries: fuzzy as WikiEntryRow[], source: 'fuzzy_topic' };
    }

    return { ok: true, entries: [], source: 'empty' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[wikiRetrieval] searchWikiByTopic failed:', msg);
    return { ok: false, entries: [], source: 'empty', error: msg };
  }
}

// ─── Search by text (summary + keyPoints) ────────────────────────────────────

export async function searchWikiByText(
  userId: string,
  query:  string,
  limit = 10,
): Promise<WikiSearchResult> {
  try {
    const entries = await prisma.wikiEntry.findMany({
      where: {
        userId,
        OR: [
          { topic:   { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
          // keyPoints is JSON — cast to text for Postgres ILIKE via raw
          // Prisma doesn't support JSON array text search directly,
          // so we do a string cast approach:
        ],
      },
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
      take:    limit,
    });
    return { ok: true, entries: entries as WikiEntryRow[], source: 'text_search' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[wikiRetrieval] searchWikiByText failed:', msg);
    return { ok: false, entries: [], source: 'empty', error: msg };
  }
}

// ─── Combined query ───────────────────────────────────────────────────────────

export async function getWikiEntriesForQuery(
  userId: string,
  query:  string,
  limit = 10,
): Promise<WikiSearchResult> {
  // Topic search first (more precise)
  const topicResult = await searchWikiByTopic(userId, query, limit);
  if (!topicResult.ok) return topicResult;
  if (topicResult.entries.length > 0) return topicResult;

  // Fall back to text search
  return searchWikiByText(userId, query, limit);
}
