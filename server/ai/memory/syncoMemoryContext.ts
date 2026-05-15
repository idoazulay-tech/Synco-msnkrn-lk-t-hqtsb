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

// ─── buildMemoryContextBlock ──────────────────────────────────────────────────
// Creates a Hebrew-language context block to be prepended to the user prompt.
// Returns an empty string when there are no memories — safe to concatenate.
//
// Output format example:
//
//   [הקשר זיכרון רלוונטי של סינקו]
//   1. המשתמש בדרך כלל מתחיל את שגרת הבוקר ב-7:00.
//   2. פגישה עם לקוח בדרך כלל נמשכת שעה וחצי.
//   [סוף הקשר זיכרון]

export function buildMemoryContextBlock(memories: SyncoRetrievedMemory[]): string {
  if (memories.length === 0) return '';

  const lines = memories
    .map((m, idx) => `${idx + 1}. ${m.content.trim()}`)
    .join('\n');

  return `[הקשר זיכרון רלוונטי של סינקו]\n${lines}\n[סוף הקשר זיכרון]`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DEFAULT_MAX_MEMORIES = 5;
const SCORE_THRESHOLD      = 0.72;

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
    // ── Retrieve from Qdrant in parallel ─────────────────────────────────────
    const [eventResults, insightResults] = await Promise.all([
      searchMemory(text, userId, 'events',   maxMemories, SCORE_THRESHOLD),
      searchMemory(text, userId, 'insights', 3,           SCORE_THRESHOLD),
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

    // ── No memories found ─────────────────────────────────────────────────────
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

    // ── Build enriched prompt ─────────────────────────────────────────────────
    const contextBlock = buildMemoryContextBlock(memories);
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
