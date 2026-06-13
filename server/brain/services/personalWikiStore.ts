/**
 * Synco Personal Wiki Store — Phase 9
 *
 * Persistence layer for WikiEntry Prisma model.
 * Implements upsert logic: creates new entries, merges into existing ones.
 *
 * Upsert rules:
 * - Match by userId + topic (unique constraint in DB)
 * - On create: insert as-is
 * - On update: merge keyPoints (no duplicates), append sourceSignalIds,
 *              update confidence carefully (weighted average, never decrease below 0.3)
 *              never overwrite non-empty summary with empty one
 */

import { prisma } from '../../lib/prisma.js';
import type { WikiUpdateCandidate } from '../types/personalWiki.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpsertWikiResult {
  ok:           boolean;
  upsertedCount: number;
  createdTopics: string[];
  updatedTopics: string[];
  error?:        string;
}

export interface WikiEntryRow {
  id:              string;
  userId:          string;
  topic:           string;
  parentTopic:     string | null;
  summary:         string;
  keyPoints:       unknown;  // JSON — string[]
  sourceSignalIds: unknown;  // JSON — string[]
  confidence:      number;
  sensitivityLevel: string;
  createdAt:       Date;
  updatedAt:       Date;
}

// ─── Key point deduplication ──────────────────────────────────────────────────

function mergeKeyPoints(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map(k => k.trim().toLowerCase()));
  const merged = [...existing];
  for (const point of incoming) {
    if (!seen.has(point.trim().toLowerCase())) {
      merged.push(point);
      seen.add(point.trim().toLowerCase());
    }
  }
  return merged;
}

function mergeSignalIds(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const id of incoming) {
    if (!seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  return merged;
}

function blendConfidence(existing: number, incoming: number, incomingWeight = 0.3): number {
  const blended = existing * (1 - incomingWeight) + incoming * incomingWeight;
  return Math.max(0.3, Math.min(1, blended));
}

// ─── Upsert candidates ────────────────────────────────────────────────────────

export async function upsertWikiUpdateCandidates(
  userId: string,
  candidates: WikiUpdateCandidate[],
): Promise<UpsertWikiResult> {
  const createdTopics: string[] = [];
  const updatedTopics: string[] = [];
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const existing = await prisma.wikiEntry.findUnique({
        where: { userId_topic: { userId, topic: candidate.topic } },
      });

      if (!existing) {
        // Create new entry
        await prisma.wikiEntry.create({
          data: {
            userId,
            topic:           candidate.topic,
            summary:         `נושא: ${candidate.topic}`,
            keyPoints:       candidate.newKeyPoints,
            sourceSignalIds: candidate.sourceSignalIds,
            confidence:      candidate.confidence,
          },
        });
        createdTopics.push(candidate.topic);
      } else {
        // Update existing — merge carefully
        const existingKeyPoints = Array.isArray(existing.keyPoints)
          ? (existing.keyPoints as string[])
          : [];
        const existingSignalIds = Array.isArray(existing.sourceSignalIds)
          ? (existing.sourceSignalIds as string[])
          : [];

        const mergedKeyPoints  = mergeKeyPoints(existingKeyPoints, candidate.newKeyPoints);
        const mergedSignalIds  = mergeSignalIds(existingSignalIds, candidate.sourceSignalIds);
        const newConfidence    = blendConfidence(existing.confidence, candidate.confidence);

        await prisma.wikiEntry.update({
          where: { userId_topic: { userId, topic: candidate.topic } },
          data:  {
            keyPoints:       mergedKeyPoints,
            sourceSignalIds: mergedSignalIds,
            confidence:      newConfidence,
          },
        });
        updatedTopics.push(candidate.topic);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[personalWikiStore] upsert failed for topic:', candidate.topic, msg);
      errors.push(`${candidate.topic}: ${msg}`);
    }
  }

  return {
    ok:            errors.length === 0,
    upsertedCount: createdTopics.length + updatedTopics.length,
    createdTopics,
    updatedTopics,
    error:         errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listWikiEntriesForUser(userId: string): Promise<WikiEntryRow[]> {
  try {
    return await prisma.wikiEntry.findMany({
      where:   { userId },
      orderBy: { updatedAt: 'desc' },
    }) as WikiEntryRow[];
  } catch (err: unknown) {
    console.error('[personalWikiStore] listWikiEntriesForUser failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getWikiEntryByTopic(userId: string, topic: string): Promise<WikiEntryRow | null> {
  try {
    return await prisma.wikiEntry.findUnique({
      where: { userId_topic: { userId, topic } },
    }) as WikiEntryRow | null;
  } catch (err: unknown) {
    console.error('[personalWikiStore] getWikiEntryByTopic failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
