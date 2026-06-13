/**
 * Synco RawEvent Store — Phase 9
 *
 * Persistence layer for RawCaptureEvent Prisma model.
 * All functions are wrapped safely — failures never crash the pipeline.
 *
 * Note: rawContent is stored as-is. Retention enforcement (deleting after
 * retainRawUntil) is a future background job, not this service's job.
 */

import { prisma } from '../../lib/prisma.js';
import type { RawEvent } from '../types/rawEvent.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveRawEventResult {
  ok:      boolean;
  id?:     string;
  error?:  string;
}

export interface ListRawEventsResult {
  ok:     boolean;
  events: StoredRawEvent[];
  error?: string;
}

export interface StoredRawEvent {
  id:               string;
  userId:           string;
  sourceType:       string;
  sourceName:       string;
  contentType:      string;
  rawContent:       string;
  languageHint:     string | null;
  processingStatus: string;
  sensitivityLevel: string;
  retentionPolicy:  string;
  capturedAt:       Date;
  createdAt:        Date;
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveRawEvent(rawEvent: RawEvent): Promise<SaveRawEventResult> {
  try {
    const retainRawUntil = rawEvent.privacy.rawRetentionUntil
      ? new Date(rawEvent.privacy.rawRetentionUntil)
      : new Date(Date.now() + 7 * 86_400_000);

    const created = await prisma.rawCaptureEvent.create({
      data: {
        userId:           rawEvent.userId,
        sourceType:       rawEvent.sourceType,
        sourceName:       rawEvent.sourceName,
        contentType:      rawEvent.contentType,
        rawContent:       rawEvent.rawContent,
        languageHint:     rawEvent.metadata.languageHint ?? null,
        capturedAt:       new Date(rawEvent.capturedAt),
        processingStatus: rawEvent.processingStatus,
        sensitivityLevel: rawEvent.privacy.sensitivityLevel,
        retentionPolicy:  rawEvent.privacy.retentionPolicy,
        retainRawUntil,
        metadata:         rawEvent.metadata as object,
      },
    });

    return { ok: true, id: created.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rawEventStore] saveRawEvent failed:', msg);
    return { ok: false, error: msg };
  }
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getRawEventById(id: string): Promise<StoredRawEvent | null> {
  try {
    return await prisma.rawCaptureEvent.findUnique({ where: { id } }) as StoredRawEvent | null;
  } catch (err: unknown) {
    console.error('[rawEventStore] getRawEventById failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── List recent ──────────────────────────────────────────────────────────────

export async function listRecentRawEventsForUser(
  userId: string,
  limit = 20,
): Promise<ListRawEventsResult> {
  try {
    const events = await prisma.rawCaptureEvent.findMany({
      where:   { userId },
      orderBy: { capturedAt: 'desc' },
      take:    limit,
    });
    return { ok: true, events: events as StoredRawEvent[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rawEventStore] listRecentRawEventsForUser failed:', msg);
    return { ok: false, events: [], error: msg };
  }
}

// ─── Update processing status ────────────────────────────────────────────────

export async function updateRawEventStatus(
  id: string,
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped',
): Promise<boolean> {
  try {
    await prisma.rawCaptureEvent.update({
      where: { id },
      data:  { processingStatus: status },
    });
    return true;
  } catch (err: unknown) {
    console.error('[rawEventStore] updateRawEventStatus failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
