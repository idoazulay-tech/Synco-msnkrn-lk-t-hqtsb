/**
 * Synco Signal Retrieval — Phase 10
 *
 * Search and filter BrainSignal records from Postgres.
 * All search is keyword-based — no vector/semantic yet.
 *
 * Functions:
 *   searchSignalsByType     — filter by signalType enum value
 *   searchSignalsByText     — ILIKE on title + summary
 *   searchSignalsByEntity   — match against relatedEntities JSON (cast)
 *   getSignalsForQuery      — combined: type hint → text fallback
 */

import { prisma } from '../../lib/prisma.js';
import type { StoredSignal } from './signalStore.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignalSearchResult {
  ok:      boolean;
  signals: StoredSignal[];
  source:  'by_type' | 'by_text' | 'by_entity' | 'combined' | 'empty';
  error?:  string;
}

// ─── By type ──────────────────────────────────────────────────────────────────

export async function searchSignalsByType(
  userId:     string,
  signalType: string,
  limit = 20,
): Promise<SignalSearchResult> {
  try {
    const signals = await prisma.brainSignal.findMany({
      where:   { userId, signalType },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take:    limit,
    });
    return { ok: true, signals: signals as StoredSignal[], source: 'by_type' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signalRetrieval] searchSignalsByType failed:', msg);
    return { ok: false, signals: [], source: 'empty', error: msg };
  }
}

// ─── By text ──────────────────────────────────────────────────────────────────

export async function searchSignalsByText(
  userId: string,
  query:  string,
  limit = 20,
): Promise<SignalSearchResult> {
  try {
    const signals = await prisma.brainSignal.findMany({
      where: {
        userId,
        OR: [
          { title:   { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take:    limit,
    });
    return { ok: true, signals: signals as StoredSignal[], source: 'by_text' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signalRetrieval] searchSignalsByText failed:', msg);
    return { ok: false, signals: [], source: 'empty', error: msg };
  }
}

// ─── By entity (relatedEntities JSON array) ───────────────────────────────────

export async function searchSignalsByEntity(
  userId:      string,
  entityLabel: string,
  limit = 20,
): Promise<SignalSearchResult> {
  try {
    // relatedEntities is a JSON array of strings — use raw query for ILIKE on JSON cast
    const signals = await prisma.$queryRaw<StoredSignal[]>`
      SELECT id, "userId", "rawEventId", "signalType", title, summary,
             confidence, "evidenceSource", "suggestedMemoryType",
             "shouldCreateTask", "shouldUpdateWiki", "shouldUpdateGraph",
             "sensitivityLevel", "createdAt"
      FROM "BrainSignal"
      WHERE "userId" = ${userId}
        AND "relatedEntities"::text ILIKE ${'%' + entityLabel + '%'}
      ORDER BY confidence DESC, "createdAt" DESC
      LIMIT ${limit}
    `;
    return { ok: true, signals, source: 'by_entity' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signalRetrieval] searchSignalsByEntity failed:', msg);
    return { ok: false, signals: [], source: 'empty', error: msg };
  }
}

// ─── Combined query ───────────────────────────────────────────────────────────

export async function getSignalsForQuery(
  userId: string,
  query:  string,
  limit = 20,
): Promise<SignalSearchResult> {
  try {
    // Run text + entity search in parallel
    const [textResult, entityResult] = await Promise.all([
      searchSignalsByText(userId, query, limit),
      searchSignalsByEntity(userId, query, limit),
    ]);

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const merged: StoredSignal[] = [];
    for (const sig of [...(textResult.signals), ...(entityResult.signals)]) {
      if (!seen.has(sig.id)) { seen.add(sig.id); merged.push(sig); }
    }

    // Sort by confidence desc
    merged.sort((a, b) => b.confidence - a.confidence);

    return {
      ok:      textResult.ok || entityResult.ok,
      signals: merged.slice(0, limit),
      source:  'combined',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, signals: [], source: 'empty', error: msg };
  }
}
