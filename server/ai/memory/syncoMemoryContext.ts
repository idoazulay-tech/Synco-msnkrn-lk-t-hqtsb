// ─── Synco Brain Infrastructure — Memory Context Layer ────────────────────────
// File:    server/ai/memory/syncoMemoryContext.ts
// Purpose: Enrich AI user prompts with relevant memories retrieved from long-term
//          storage (Qdrant), so that Synco Brain can personalize AI responses
//          without modifying any existing AI service logic.
//
// Current state: SAFE PLACEHOLDER — no external connections yet.
// All functions return gracefully. Nothing throws. Nothing connects to Qdrant.
//
// TODO (next step): Connect to Qdrant using the existing infrastructure in
//   server/lib/qdrant.ts and the QDRANT_URL / QDRANT_API_KEY env secrets.
//   Guard behind AI_FEATURES.externalKnowledgeEnabled (server/ai/aiFeatureFlags.ts).
//
// Integration point (future):
//   In syncoAIReasoningService.ts, before each provider.generateStructured() call:
//   const enriched = await enrichUserPromptWithMemory({ userId, text: userPrompt, patternFamily });
//   const finalPrompt = enriched.ok ? enriched.enrichedText : userPrompt;
// ──────────────────────────────────────────────────────────────────────────────

// ─── Input type ───────────────────────────────────────────────────────────────

export interface SyncoMemoryContextInput {
  /** The user whose long-term memory should be queried. */
  userId: string;
  /** The raw user prompt text to be potentially enriched. */
  text: string;
  /** Optional: the pattern family classified by the AI layer (e.g. 'operational_sequence').
   *  Used later to scope the Qdrant collection search by pattern type. */
  patternFamily?: string;
  /** Optional: the specific pattern name within the family (e.g. 'morning_routine').
   *  Used later to further narrow memory retrieval. */
  patternName?: string;
  /** Maximum number of memories to retrieve and inject. Defaults to 5. */
  maxMemories?: number;
}

// ─── Memory record type ───────────────────────────────────────────────────────

export interface SyncoRetrievedMemory {
  /** Qdrant point ID or any unique string identifier for this memory. */
  id: string;
  /** Which collection or subsystem this memory came from
   *  (e.g. 'user_events', 'user_insights', 'user_profile', 'synco_knowledge'). */
  source: string;
  /** The actual text content to be injected into the prompt context block. */
  content: string;
  /** Cosine similarity score from Qdrant (0–1). Higher = more relevant. */
  score?: number;
  /** ISO timestamp of when this memory was created or last updated. */
  createdAt?: string;
  /** Arbitrary metadata payload (task IDs, pattern tags, confidence scores, etc.). */
  metadata?: Record<string, unknown>;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SyncoMemoryContextResult {
  /** True if the function completed without error (even if no memories were found). */
  ok: boolean;
  /** The original unmodified input text. Always present regardless of outcome. */
  originalText: string;
  /** The enriched text ready to be passed to the AI provider.
   *  Equals originalText when no memories were available or an error occurred. */
  enrichedText: string;
  /** The memories that were retrieved and injected (may be empty). */
  memories: SyncoRetrievedMemory[];
  /** Non-fatal warnings (e.g. partial retrieval failure, score below threshold). */
  warnings: string[];
  /** What happened during this call:
   *  - 'memory_enriched':  memories found and injected into enrichedText
   *  - 'memory_empty':     retrieval succeeded but returned no relevant memories
   *  - 'memory_disabled':  externalKnowledgeEnabled is false or userId is a guest
   *  - 'memory_error':     an error occurred; enrichedText === originalText (safe fallback)
   */
  source: 'memory_enriched' | 'memory_empty' | 'memory_disabled' | 'memory_error';
}

// ─── buildMemoryContextBlock ──────────────────────────────────────────────────
// Creates a Hebrew-language context block to be prepended to the user prompt.
// Returns an empty string when there are no memories — safe to concatenate directly.
//
// Output format example:
//
//   [הקשר זיכרון רלוונטי של סינקו]
//   1. המשתמש בדרך כלל מתחיל את שגרת הבוקר ב-7:00.
//   2. פגישה עם לקוח בדרך כלל נמשכת שעה וחצי.
//   [סוף הקשר זיכרון]
//
// TODO: Consider adding a `patternFamily` label per memory line so the AI can
//       understand the context type of each injected memory.

export function buildMemoryContextBlock(memories: SyncoRetrievedMemory[]): string {
  if (memories.length === 0) return '';

  const lines = memories
    .map((m, idx) => `${idx + 1}. ${m.content.trim()}`)
    .join('\n');

  return `[הקשר זיכרון רלוונטי של סינקו]\n${lines}\n[סוף הקשר זיכרון]`;
}

// ─── enrichUserPromptWithMemory ───────────────────────────────────────────────
// Main exported function. Takes a user prompt + context, retrieves relevant
// memories, and returns an enriched prompt ready for the AI provider.
//
// SAFETY CONTRACT:
// - Never throws under any circumstances.
// - If anything fails, returns original text unchanged with source='memory_error'.
// - If userId or text is missing, returns ok:false immediately.
// - All errors are caught and surfaced as warnings, not exceptions.
//
// TODO (Qdrant integration):
//   1. Import { qdrantClient } from '../../lib/qdrant.js'
//   2. Import { AI_FEATURES } from '../aiFeatureFlags.js'
//   3. Guard: if (!AI_FEATURES.externalKnowledgeEnabled) return disabled result
//   4. Generate embedding for `input.text` using the OpenAI embeddings API
//      (text-embedding-3-small, 1536 dimensions)
//   5. Search Qdrant collections:
//        - 'user_events'   — past task actions for this userId
//        - 'user_insights' — detected patterns for this userId
//        - 'user_profile'  — user preferences and habits
//      Use filter: { must: [{ key: 'userId', match: { value: input.userId } }] }
//      Limit: input.maxMemories ?? DEFAULT_MAX_MEMORIES
//      Score threshold: 0.72 (reject low-relevance results)
//   6. Optionally narrow by patternFamily if provided
//   7. Map Qdrant results to SyncoRetrievedMemory[]
//   8. Call buildMemoryContextBlock(memories)
//   9. Prepend context block to original text with a blank line separator:
//      enrichedText = contextBlock + '\n\n' + text
//  10. Return source: 'memory_enriched'

const DEFAULT_MAX_MEMORIES = 5;

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

  // ── Resolve options ──────────────────────────────────────────────────────────
  const _maxMemories = typeof input.maxMemories === 'number' && input.maxMemories > 0
    ? input.maxMemories
    : DEFAULT_MAX_MEMORIES;

  // Suppress unused variable warning until Qdrant integration is wired
  void _maxMemories;
  void input.patternFamily;
  void input.patternName;

  try {
    // TODO: Replace this block with Qdrant retrieval (see TODO above).
    //       For now, always return memory_empty so the calling pipeline runs unchanged.
    const memories: SyncoRetrievedMemory[] = [];

    // ── No memories available ────────────────────────────────────────────────
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

    // ── Build enriched prompt (reached when Qdrant is connected) ─────────────
    const contextBlock  = buildMemoryContextBlock(memories);
    const enrichedText  = contextBlock ? `${contextBlock}\n\n${text}` : text;

    return {
      ok:           true,
      originalText: text,
      enrichedText,
      memories,
      warnings:     [],
      source:       'memory_enriched',
    };

  } catch (err: unknown) {
    // ── Catch-all: never throw, always return original text ──────────────────
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
