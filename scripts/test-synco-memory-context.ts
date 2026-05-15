#!/usr/bin/env tsx
/**
 * Synco Brain — Memory Context Foundation Tests
 * ──────────────────────────────────────────────
 * Tests the wired implementation in:
 *   server/ai/memory/syncoMemoryContext.ts
 *
 * No test framework. No Vitest. No Jest.
 * Run with: npx tsx scripts/test-synco-memory-context.ts
 *
 * NOTE: Real Qdrant enrichment (source='memory_enriched') is NOT tested here.
 * That path requires:
 *   - SYNCO_EXTERNAL_KNOWLEDGE_ENABLED=true
 *   - QDRANT_URL + QDRANT_API_KEY env secrets
 *   - Data already stored for the test userId
 * All tests here run without env vars set, so externalKnowledgeEnabled === false,
 * and the expected source for valid input is 'memory_disabled'.
 */

import {
  enrichUserPromptWithMemory,
  buildMemoryContextBlock,
  type SyncoRetrievedMemory,
} from '../server/ai/memory/syncoMemoryContext.js';

// ─── Minimal assert helper ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

// ─── Test 1: Empty memories block ─────────────────────────────────────────────

section('Test 1: buildMemoryContextBlock([])');

const emptyBlock = buildMemoryContextBlock([]);

assert(
  'returns empty string for empty array',
  emptyBlock === '',
  `got: ${JSON.stringify(emptyBlock)}`,
);

// ─── Test 2: Memory block with 2 memories ─────────────────────────────────────

section('Test 2: buildMemoryContextBlock with 2 memories');

const fakeMemories: SyncoRetrievedMemory[] = [
  {
    id:        'mem-001',
    source:    'user_events',
    content:   'המשתמש בדרך כלל מתחיל שגרת בוקר ב-7:00',
    score:     0.91,
    createdAt: '2026-05-01T07:00:00.000Z',
    metadata:  { patternFamily: 'operational_sequence' },
  },
  {
    id:      'mem-002',
    source:  'user_insights',
    content: 'פגישה עם לקוח בדרך כלל נמשכת שעה וחצי',
    score:   0.85,
  },
];

const block = buildMemoryContextBlock(fakeMemories);

assert(
  'output contains opening tag',
  block.includes('[הקשר זיכרון רלוונטי של סינקו]'),
  `got: ${JSON.stringify(block)}`,
);
assert(
  'output contains closing tag',
  block.includes('[סוף הקשר זיכרון]'),
  `got: ${JSON.stringify(block)}`,
);
assert(
  'output contains "1." prefix for first memory',
  block.includes('1. '),
  `got: ${JSON.stringify(block)}`,
);
assert(
  'output contains "2." prefix for second memory',
  block.includes('2. '),
  `got: ${JSON.stringify(block)}`,
);
assert(
  'output contains first memory content',
  block.includes('המשתמש בדרך כלל מתחיל שגרת בוקר ב-7:00'),
  `got: ${JSON.stringify(block)}`,
);
assert(
  'output contains second memory content',
  block.includes('פגישה עם לקוח בדרך כלל נמשכת שעה וחצי'),
  `got: ${JSON.stringify(block)}`,
);

// ─── Test 3: Valid input — feature flag is OFF (default) ──────────────────────
//
// IMPORTANT: Because SYNCO_EXTERNAL_KNOWLEDGE_ENABLED is not set in this test
// environment, externalKnowledgeEnabled === false.
// The expected source is 'memory_disabled', NOT 'memory_empty'.
// Real Qdrant enrichment is not exercised in this test suite.

section('Test 3: enrichUserPromptWithMemory — valid input, flag OFF (memory_disabled)');

const INPUT_TEXT = 'מחר אני צריך לסדר את היום שלי';

const result3 = await enrichUserPromptWithMemory({
  userId:        'test-user',
  text:          INPUT_TEXT,
  patternFamily: 'generic_planning',
  maxMemories:   5,
});

assert('ok === true',                 result3.ok === true,                `got: ${result3.ok}`);
assert('source === memory_disabled',  result3.source === 'memory_disabled', `got: ${result3.source}`);
assert('originalText is input',       result3.originalText === INPUT_TEXT,  `got: ${result3.originalText}`);
assert('enrichedText === original',   result3.enrichedText === INPUT_TEXT,  `got: ${result3.enrichedText}`);
assert('memories is empty array',     result3.memories.length === 0,        `got length: ${result3.memories.length}`);
assert('warnings is empty array',     result3.warnings.length === 0,        `got: ${JSON.stringify(result3.warnings)}`);

// ─── Test 4: Missing userId ────────────────────────────────────────────────────

section('Test 4: enrichUserPromptWithMemory — missing userId');

const result4 = await enrichUserPromptWithMemory({
  userId: '',
  text:   'תוסיף לי משימה לבוקר',
});

assert('ok === false',              result4.ok === false,              `got: ${result4.ok}`);
assert('source === memory_error',   result4.source === 'memory_error', `got: ${result4.source}`);
assert('enrichedText still returns text (may be empty string)',
  typeof result4.enrichedText === 'string',
  `got type: ${typeof result4.enrichedText}`
);
assert('warnings is non-empty',     result4.warnings.length > 0,      `got: ${JSON.stringify(result4.warnings)}`);

// ─── Test 5: Missing text ──────────────────────────────────────────────────────

section('Test 5: enrichUserPromptWithMemory — missing text');

const result5 = await enrichUserPromptWithMemory({
  userId: 'test-user',
  text:   '',
});

assert('ok === false',                 result5.ok === false,              `got: ${result5.ok}`);
assert('source === memory_error',      result5.source === 'memory_error', `got: ${result5.source}`);
assert('enrichedText is empty string', result5.enrichedText === '',        `got: ${JSON.stringify(result5.enrichedText)}`);
assert('warnings is non-empty',        result5.warnings.length > 0,       `got: ${JSON.stringify(result5.warnings)}`);

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════════');
console.log(`  Synco Memory Context Tests — ${passed + failed} total`);
console.log(`  ✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log('══════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  throw new Error(`${failed} test(s) failed.`);
}

console.log('All tests passed.\n');
console.log('Note: source=memory_disabled is expected — SYNCO_EXTERNAL_KNOWLEDGE_ENABLED is not set.');
console.log('To test real Qdrant enrichment, set the env var and ensure data is stored for the test userId.\n');
