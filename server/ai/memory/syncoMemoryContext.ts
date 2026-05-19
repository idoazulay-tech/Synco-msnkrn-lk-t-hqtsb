// ─── Synco Brain Infrastructure — Memory Context Layer ────────────────────────
// File:    server/ai/memory/syncoMemoryContext.ts
// Purpose: Enrich AI user prompts with relevant memories retrieved from long-term
//          storage (Qdrant), so that Synco Brain can personalize AI responses
//          without modifying any existing AI service logic.
//
// Current state: WIRED — real Qdrant retrieval via Brain memory service.
//   Guarded behind AI_FEATURES.externalKnowledgeEnabled.
//   Set env var SYNCO_EXTERNAL_KNOWLEDGE_ENABLED=true to activate.
//
// Confidence-tier policy (v2):
//   Memories are retrieved with a low threshold (0.35) to capture early Hebrew
//   MVP signals. Each memory is assigned a confidence level before being used.
//   Only memories with sufficient confidence are exposed to the AI — and even
//   then, weak memories are wrapped in cautious blocks to prevent false facts.
//
// Integration point (future):
//   In syncoAIReasoningService.ts, before each provider.generateStructured() call:
//   const enriched = await enrichUserPromptWithMemory({ userId, text: userPrompt, patternFamily });
//   const finalPrompt = enriched.ok ? enriched.enrichedText : userPrompt;
// ──────────────────────────────────────────────────────────────────────────────

import { searchMemory } from '../../brain/services/memory.js';
import { AI_FEATURES }  from '../aiFeatureFlags.js';

// ─── Input type ───────────────────────────────────────────────────────────────

export interface SyncoMemoryContextInput {
  userId: string;
  text: string;
  patternFamily?: string;
  patternName?: string;
  maxMemories?: number;
}

// ─── Memory record type ───────────────────────────────────────────────────────

export interface SyncoRetrievedMemory {
  id: string;
  source: string;
  content: string;
  score?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SyncoMemoryContextResult {
  ok: boolean;
  originalText: string;
  enrichedText: string;
  memories: SyncoRetrievedMemory[];
  warnings: string[];
  source: 'memory_enriched' | 'memory_empty' | 'memory_disabled' | 'memory_error';
}

// ─── Confidence tiers ─────────────────────────────────────────────────────────
//
//  ignore           score < 0.35   — too weak, discard entirely
//  weak_signal      0.35 – <0.50   — may prompt a clarifying question only
//  suggested_context 0.50 – <0.70  — possible connection, ask for confirmation
//  active_context   >= 0.70        — use as active context
//
export type MemoryConfidenceLevel =
  | 'ignore'
  | 'weak_signal'
  | 'suggested_context'
  | 'active_context';

export function getMemoryConfidenceLevel(score: number): MemoryConfidenceLevel {
  if (score >= 0.70) return 'active_context';
  if (score >= 0.50) return 'suggested_context';
  if (score >= 0.35) return 'weak_signal';
  return 'ignore';
}

// ─── buildMemoryContextBlock ──────────────────────────────────────────────────
// Creates a Hebrew-language context block appropriate to the confidence level.
// bestScore drives which block variant is emitted.
// Returns an empty string when there are no memories — safe to concatenate.

export function buildMemoryContextBlock(
  memories: SyncoRetrievedMemory[],
  bestScore?: number
): string {
  if (memories.length === 0) return '';

  const level = bestScore !== undefined
    ? getMemoryConfidenceLevel(bestScore)
    : 'active_context';

  const lines = memories
    .map((m, idx) => `${idx + 1}. ${m.content.trim()}`)
    .join('\n');

  if (level === 'weak_signal') {
    return (
      '[אות זיכרון חלש לבדיקה בלבד]\n' +
      'נמצא זיכרון שאולי קשור לקלט הנוכחי, אך רמת הביטחון נמוכה.\n' +
      'אין להציג זאת כעובדה על המשתמש.\n' +
      'מותר להשתמש בזה רק כדי לשאול שאלת הבהרה קצרה.\n' +
      `${lines}\n` +
      '[סוף אות זיכרון חלש]'
    );
  }

  if (level === 'suggested_context') {
    return (
      '[הקשר אפשרי לבדיקה]\n' +
      'נמצא זיכרון שעשוי להיות קשור לקלט הנוכחי.\n' +
      'אין להציג זאת כעובדה מוחלטת.\n' +
      'אפשר להציע קשר בזהירות ולבקש אישור מהמשתמש.\n' +
      `${lines}\n` +
      '[סוף הקשר אפשרי]'
    );
  }

  // active_context
  return `[הקשר זיכרון רלוונטי של סינקו]\n${lines}\n[סוף הקשר זיכרון]`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DEFAULT_MAX_MEMORIES = 5;

// Retrieval threshold: 0.35 is deliberately low for early Hebrew MVP testing.
// Hebrew embeddings via text-embedding-3-small produce lower cosine scores than
// English. This threshold captures early signals for clarifying-question use.
// TODO: tune upward (towards 0.55–0.65) once a real user corpus is collected.
const RETRIEVAL_THRESHOLD = 0.35;

function extractContent(payload: Record<string, unknown>): string {
  if (typeof payload.text        === 'string' && payload.text)        return payload.text;
  if (typeof payload.description === 'string' && payload.description) return payload.description;
  if (typeof payload.title       === 'string' && payload.title)       return payload.title;
  if (typeof payload.value       === 'string' && payload.value)       return payload.value;
  return '';
}

function extractCreatedAt(payload: Record<string, unknown>): string | undefined {
  const v = payload.timestamp ?? payload.createdAt ?? payload.lastUpdated;
  return typeof v === 'string' ? v : undefined;
}

function deduplicateMemories(memories: SyncoRetrievedMemory[]): SyncoRetrievedMemory[] {
  const seenIds      = new Set<string>();
  const seenContents = new Set<string>();
  const result: SyncoRetrievedMemory[] = [];

  for (const m of memories) {
    const contentKey = m.content.trim().toLowerCase();
    if (seenIds.has(m.id) || seenContents.has(contentKey)) continue;
    seenIds.add(m.id);
    seenContents.add(contentKey);
    result.push(m);
  }

  return result;
}

// ─── enrichUserPromptWithMemory ───────────────────────────────────────────────
// Main exported function. Retrieves relevant memories from Qdrant and returns
// an enriched prompt ready for the AI provider.
//
// SAFETY CONTRACT:
// - Never throws under any circumstances.
// - If anything fails, returns original text unchanged with source='memory_error'.
// - If userId or text is missing, returns ok:false immediately.
// - If externalKnowledgeEnabled is false, returns source='memory_disabled' (ok:true).
// - All errors are caught and surfaced as warnings, not exceptions.
//
// CONFIDENCE CONTRACT:
// - Memories below RETRIEVAL_THRESHOLD (0.35) are discarded at the Qdrant layer.
// - Memories between 0.35–0.50 get a cautious weak-signal block.
// - Memories between 0.50–0.70 get a suggested-context block.
// - Only memories ≥ 0.70 are treated as active context.
// - In all cases, AI must not use memory as confirmed fact without user confirmation.

export async function enrichUserPromptWithMemory(
  input: SyncoMemoryContextInput
): Promise<SyncoMemoryContextResult> {
  // ── Guard: missing required fields ──────────────────────────────────────────
  const userId = typeof input?.userId === 'string' ? input.userId.trim() : '';
  const text   = typeof input?.text   === 'string' ? input.text.trim()   : '';

  if (!userId || !text) {
    return {
      ok:           false,
      originalText: text,
      enrichedText: text,
      memories:     [],
      warnings:     ['enrichUserPromptWithMemory: userId and text are required'],
      source:       'memory_error',
    };
  }

  // ── Guard: feature flag ──────────────────────────────────────────────────────
  if (!AI_FEATURES.externalKnowledgeEnabled) {
    return {
      ok:           true,
      originalText: text,
      enrichedText: text,
      memories:     [],
      warnings:     [],
      source:       'memory_disabled',
    };
  }

  // ── Resolve options ──────────────────────────────────────────────────────────
  const maxMemories = typeof input.maxMemories === 'number' && input.maxMemories > 0
    ? input.maxMemories
    : DEFAULT_MAX_MEMORIES;

  try {
    // ── Retrieve from Qdrant using low retrieval threshold ────────────────────
    const [eventResults, insightResults] = await Promise.all([
      searchMemory(text, userId, 'events',   maxMemories, RETRIEVAL_THRESHOLD),
      searchMemory(text, userId, 'insights', 3,           RETRIEVAL_THRESHOLD),
    ]);

    // ── Map to SyncoRetrievedMemory[] ─────────────────────────────────────────
    const rawMemories: SyncoRetrievedMemory[] = [
      ...eventResults.map(r => ({
        id:        r.id,
        source:    'user_events',
        content:   extractContent(r.payload),
        score:     r.score,
        createdAt: extractCreatedAt(r.payload),
        metadata:  r.payload,
      })),
      ...insightResults.map(r => ({
        id:        r.id,
        source:    'user_insights',
        content:   extractContent(r.payload),
        score:     r.score,
        createdAt: extractCreatedAt(r.payload),
        metadata:  r.payload,
      })),
    ];

    // ── Filter out blank content ───────────────────────────────────────────────
    const withContent = rawMemories.filter(m => m.content.trim().length > 0);

    // ── Deduplicate by id and content ─────────────────────────────────────────
    const memories = deduplicateMemories(withContent);

    // ── No memories found above retrieval threshold ───────────────────────────
    if (memories.length === 0) {
      return {
        ok:           true,
        originalText: text,
        enrichedText: text,
        memories:     [],
        warnings:     [],
        source:       'memory_empty',
      };
    }

    // ── Determine best confidence level (highest score wins) ──────────────────
    const bestScore = Math.max(...memories.map(m => m.score ?? 0));
    const bestLevel = getMemoryConfidenceLevel(bestScore);

    // Discard memories below ignore threshold (belt-and-suspenders)
    if (bestLevel === 'ignore') {
      return {
        ok:           true,
        originalText: text,
        enrichedText: text,
        memories:     [],
        warnings:     [],
        source:       'memory_empty',
      };
    }

    // ── Build confidence-appropriate context block ────────────────────────────
    const contextBlock = buildMemoryContextBlock(memories, bestScore);
    const enrichedText = contextBlock ? `${contextBlock}\n\n${text}` : text;

    return {
      ok:           true,
      originalText: text,
      enrichedText,
      memories,
      warnings:     [],
      source:       'memory_enriched',
    };

  } catch (err: unknown) {
    // ── Catch-all: never throw, always return original text ───────────────────
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok:           false,
      originalText: text,
      enrichedText: text,
      memories:     [],
      warnings:     [`enrichUserPromptWithMemory error: ${message}`],
      source:       'memory_error',
    };
  }
}
