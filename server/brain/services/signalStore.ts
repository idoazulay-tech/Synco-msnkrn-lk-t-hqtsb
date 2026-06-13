/**
 * Synco Signal Store — Phase 9
 *
 * Persistence layer for BrainSignal Prisma model.
 * Saves Signal[] from MeaningEngine into the database.
 * All functions are wrapped safely.
 */

import { prisma } from '../../lib/prisma.js';
import type { Signal } from '../types/signal.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveSignalsResult {
  ok:           boolean;
  savedCount:   number;
  savedIds:     string[];
  error?:       string;
}

export interface ListSignalsResult {
  ok:      boolean;
  signals: StoredSignal[];
  error?:  string;
}

export interface StoredSignal {
  id:                 string;
  userId:             string;
  rawEventId:         string | null;
  signalType:         string;
  title:              string;
  summary:            string;
  confidence:         number;
  evidenceSource:     string;
  suggestedMemoryType: string;
  shouldCreateTask:   boolean;
  shouldUpdateWiki:   boolean;
  shouldUpdateGraph:  boolean;
  sensitivityLevel:   string;
  createdAt:          Date;
}

// ─── Save batch ───────────────────────────────────────────────────────────────

export async function saveSignals(
  signals: Signal[],
  rawEventDbId?: string,    // the DB id of the saved RawCaptureEvent (not the in-memory rawEventId)
): Promise<SaveSignalsResult> {
  if (signals.length === 0) {
    return { ok: true, savedCount: 0, savedIds: [] };
  }

  const savedIds: string[] = [];
  const errors: string[] = [];

  for (const signal of signals) {
    try {
      const created = await prisma.brainSignal.create({
        data: {
          userId:              signal.userId,
          rawEventId:          rawEventDbId ?? null,
          signalType:          signal.signalType,
          title:               signal.title,
          summary:             signal.summary,
          confidence:          signal.confidence,
          evidenceSource:      signal.evidenceSource,
          suggestedMemoryType: signal.suggestedMemoryType,
          suggestedAction:     signal.suggestedAction ? (signal.suggestedAction as object) : null,
          relatedEntities:     signal.relatedEntities.length > 0
            ? (signal.relatedEntities as unknown as object)
            : null,
          shouldCreateTask:    signal.shouldCreateTask,
          shouldUpdateWiki:    signal.shouldUpdateWiki,
          shouldUpdateGraph:   signal.shouldUpdateGraph,
          sensitivityLevel:    signal.privacy.sensitivityLevel,
        },
      });
      savedIds.push(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[signalStore] saveSignal failed:', msg, '| signal:', signal.signalType);
      errors.push(`${signal.signalType}: ${msg}`);
    }
  }

  return {
    ok:         errors.length === 0,
    savedCount: savedIds.length,
    savedIds,
    error:      errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ─── List for user ────────────────────────────────────────────────────────────

export async function listSignalsForUser(
  userId: string,
  limit = 50,
): Promise<ListSignalsResult> {
  try {
    const signals = await prisma.brainSignal.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
    return { ok: true, signals: signals as StoredSignal[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signalStore] listSignalsForUser failed:', msg);
    return { ok: false, signals: [], error: msg };
  }
}

// ─── List for raw event ───────────────────────────────────────────────────────

export async function listSignalsForRawEvent(rawEventId: string): Promise<ListSignalsResult> {
  try {
    const signals = await prisma.brainSignal.findMany({
      where:   { rawEventId },
      orderBy: { createdAt: 'asc' },
    });
    return { ok: true, signals: signals as StoredSignal[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signalStore] listSignalsForRawEvent failed:', msg);
    return { ok: false, signals: [], error: msg };
  }
}
