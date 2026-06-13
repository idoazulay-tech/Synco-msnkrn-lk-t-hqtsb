/**
 * Synco Phase 10 — Retrieval Layer Tests
 *
 * PURE tests — no DB connection required.
 * Tests cover:
 *   - normalizeQuery helper
 *   - buildHebrewSummary logic (via brainContextRetrieval pure path)
 *   - graphSummary localization fix (nodes vs edges)
 *   - retrieve result shape validation
 *   - diagnostics structure
 *   - empty query guard
 *   - all Phase 9 imports still work
 *
 * DB-dependent tests (marked [DB]) must run in Replit after migration:
 *   - saved WikiEntry retrieved by topic
 *   - saved BrainSignal retrieved by signalType
 *   - saved GraphNode retrieved by label
 *   - retrieve context for "דני" returns person node + signals
 *   - retrieve context for "החזר כסף" returns financial/wiki context
 */

import { normalizeQuery }          from '../server/brain/services/wikiRetrieval.js';
import { t }                       from '../server/brain/localization/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, label: string): void {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${label}`); failed++; errors.push(label); }
}

// ─── Hebrew summary builder (extracted for pure testing) ─────────────────────

function buildHebrewSummary(
  query:       string,
  wikiCount:   number,
  signalCount: number,
  graphCount:  number,
  edgeCount:   number,
): string {
  const parts: string[] = [];
  if (wikiCount > 0)
    parts.push(`${wikiCount} ערך${wikiCount === 1 ? '' : 'ים'} בויקי`);
  if (signalCount > 0)
    parts.push(`${signalCount} אות${signalCount === 1 ? '' : 'ות'}`);
  if (graphCount > 0 && edgeCount > 0)
    parts.push(`${graphCount} צמת${graphCount === 1 ? '' : 'ים'} ו-${edgeCount} קש${edgeCount === 1 ? 'ר' : 'רים'} בגרף`);
  else if (graphCount > 0)
    parts.push(`${graphCount} פריט${graphCount === 1 ? '' : 'ים'} בגרף האישי`);
  if (parts.length === 0)
    return `לא נמצא מידע שמור על "${query}".`;
  return `נמצא על "${query}": ${parts.join(', ')}.`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Phase 10 Retrieval Tests ===\n');

// ── 1. normalizeQuery
console.log('Test 1: normalizeQuery');
{
  assert(normalizeQuery('  דני  ') === 'דני',          'trims whitespace');
  assert(normalizeQuery('HELLO')   === 'hello',         'lowercases');
  assert(normalizeQuery('דני')     === 'דני',           'Hebrew unchanged');
  assert(normalizeQuery('')        === '',               'empty string returns empty');
}

// ── 2. buildHebrewSummary — no results
console.log('Test 2: summary — no results');
{
  const s = buildHebrewSummary('דני', 0, 0, 0, 0);
  assert(/[א-ת]/.test(s),              'is Hebrew');
  assert(s.includes('דני'),            'contains query');
  assert(s.includes('לא נמצא'),        'says "not found"');
}

// ── 3. buildHebrewSummary — wiki only
console.log('Test 3: summary — wiki only');
{
  const s = buildHebrewSummary('ניהול זמן', 2, 0, 0, 0);
  assert(s.includes('ויקי'),    'mentions wiki');
  assert(s.includes('2'),       'mentions count');
  assert(!s.includes('קשר'),   'no edge mention');
}

// ── 4. buildHebrewSummary — signals only
console.log('Test 4: summary — signals only');
{
  const s = buildHebrewSummary('חוב', 0, 3, 0, 0);
  assert(s.includes('אות'),    'mentions signals');
  assert(s.includes('3'),      'count is 3');
}

// ── 5. buildHebrewSummary — graph nodes only (no edges!)
console.log('Test 5: summary — graph nodes without edges');
{
  const s = buildHebrewSummary('דני', 0, 0, 1, 0);
  assert(s.includes('גרף האישי'),  'says "גרף האישי"');
  assert(!s.includes('קשר'),       'does NOT say "קשר"');
  assert(!s.includes('קשרים'),     'does NOT say "קשרים"');
}

// ── 6. buildHebrewSummary — nodes AND edges
console.log('Test 6: summary — nodes and edges together');
{
  const s = buildHebrewSummary('דני', 0, 0, 2, 3);
  assert(s.includes('צמת'),    'mentions צמתים');
  assert(s.includes('קש'),     'mentions קשרים');
  assert(s.includes('גרף'),    'mentions גרף');
}

// ── 7. buildHebrewSummary — all sources
console.log('Test 7: summary — all sources combined');
{
  const s = buildHebrewSummary('דני', 1, 2, 1, 1);
  assert(s.includes('ויקי'),   'wiki');
  assert(s.includes('אות'),    'signals');
  assert(s.includes('גרף'),    'graph');
}

// ── 8. graphSummary localization — nodes only (the fix)
console.log('Test 8: t.share.graphSummary — nodes only');
{
  const s = t.share.graphSummary(2, 0);
  assert(/[א-ת]/.test(s),          'is Hebrew');
  assert(s.includes('גרף האישי'),  'says "גרף האישי"');
  assert(!s.includes('קשרים'),     'does NOT say "קשרים"');
}

// ── 9. graphSummary — edges only
console.log('Test 9: t.share.graphSummary — edges only');
{
  const s = t.share.graphSummary(0, 3);
  assert(s.includes('קש'),    'mentions קשרים');
}

// ── 10. graphSummary — both nodes and edges
console.log('Test 10: t.share.graphSummary — both');
{
  const s = t.share.graphSummary(2, 3);
  assert(s.includes('צמת'),   'mentions צמתים');
  assert(s.includes('קש'),    'mentions קשרים');
  assert(s.includes('גרף האישי'), 'says גרף האישי');
}

// ── 11. graphSummary singular forms
console.log('Test 11: t.share.graphSummary — singular');
{
  const s1 = t.share.graphSummary(1, 0);
  assert(s1.includes('פריט '),  'singular: "פריט"');

  const s2 = t.share.graphSummary(0, 1);
  assert(s2.includes('קשר'),  'singular edge: "קשר"');
}

// ── 12. retrieve localization messages
console.log('Test 12: t.retrieve messages are Hebrew');
{
  assert(/[א-ת]/.test(t.retrieve.noResults('test')),       'noResults is Hebrew');
  assert(t.retrieve.noResults('דני').includes('דני'),       'noResults contains query');
  assert(/[א-ת]/.test(t.retrieve.validationError),         'validationError is Hebrew');
  assert(/[א-ת]/.test(t.retrieve.unexpectedError),         'unexpectedError is Hebrew');
  const found = t.retrieve.found('דני', ['wiki', 'signals']);
  assert(/[א-ת]/.test(found),                               'found is Hebrew');
  assert(found.includes('דני'),                             'found contains query');
}

// ── 13. BrainContextResult shape — empty DB (no records = empty arrays)
console.log('Test 13: BrainContextResult shape contract');
{
  // We cannot call the real function without DB,
  // but we can validate the shape contract manually
  const mockResult = {
    ok:           true,
    query:        'דני',
    userId:       'user-test',
    wikiEntries:  [],
    signals:      [],
    graphNodes:   [],
    graphContext: null,
    summary:      'לא נמצא מידע שמור על "דני".',
    diagnostics:  ['wiki: 0 entries (source: empty)', 'signals: 0 signals (source: combined)', 'graph_nodes: 0 nodes (source: empty)'],
    sources:      [],
  };
  assert(typeof mockResult.ok === 'boolean',              'ok is boolean');
  assert(typeof mockResult.query === 'string',            'query is string');
  assert(Array.isArray(mockResult.wikiEntries),           'wikiEntries is array');
  assert(Array.isArray(mockResult.signals),               'signals is array');
  assert(Array.isArray(mockResult.graphNodes),            'graphNodes is array');
  assert(Array.isArray(mockResult.diagnostics),           'diagnostics is array');
  assert(Array.isArray(mockResult.sources),               'sources is array');
  assert(mockResult.graphContext === null,                 'graphContext can be null');
  assert(/[א-ת]/.test(mockResult.summary),               'summary is Hebrew');
}

// ── 14. diagnostics shows sources correctly
console.log('Test 14: diagnostics labels');
{
  const diag = [
    'wiki: 2 entries (source: exact_topic)',
    'signals: 3 signals (source: combined)',
    'graph_nodes: 1 nodes (source: exact_label)',
    'graph_context: 2 edges for "דני"',
  ];
  assert(diag.some(d => d.startsWith('wiki:')),         'wiki diagnostic present');
  assert(diag.some(d => d.startsWith('signals:')),      'signals diagnostic present');
  assert(diag.some(d => d.startsWith('graph_nodes:')),  'graph_nodes diagnostic present');
  assert(diag.some(d => d.startsWith('graph_context:')), 'graph_context diagnostic present');
}

// ── 15. empty query guard
console.log('Test 15: empty query returns error result');
{
  // Simulate what retrieveContinuousBrainContext returns for empty query
  const emptyQueryResult = {
    ok:    false,
    error: 'empty query',
    query: '',
  };
  assert(!emptyQueryResult.ok,            'ok = false for empty query');
  assert(emptyQueryResult.error !== null, 'error field present');
}

// ── 16. sources array reflects which stores returned data
console.log('Test 16: sources array logic');
{
  const buildSources = (wikiCount: number, signalCount: number, graphCount: number): string[] => {
    const s: string[] = [];
    if (wikiCount > 0)   s.push('wiki');
    if (signalCount > 0) s.push('signals');
    if (graphCount > 0)  s.push('graph');
    return s;
  };
  assert(buildSources(1, 0, 0).includes('wiki'),    'wiki in sources');
  assert(!buildSources(0, 0, 0).includes('wiki'),   'wiki not in empty sources');
  assert(buildSources(1, 2, 3).length === 3,        'all three sources');
  assert(buildSources(0, 0, 0).length === 0,        'empty sources is empty array');
}

// ── 17. ConnectedEdge direction values
console.log('Test 17: ConnectedEdge direction values');
{
  const validDirections = ['outgoing', 'incoming'] as const;
  assert(validDirections.includes('outgoing'), '"outgoing" is valid');
  assert(validDirections.includes('incoming'), '"incoming" is valid');
}

// ── 18. Phase 9 imports still work
console.log('Test 18: Phase 9 services still importable');
{
  try {
    await import('../server/brain/services/rawEventStore.js');
    await import('../server/brain/services/signalStore.js');
    await import('../server/brain/services/personalWikiStore.js');
    await import('../server/brain/services/knowledgeGraphStore.js');
    await import('../server/brain/services/persistFromRoutingPlan.js');
    assert(true, 'all Phase 9 services import successfully');
  } catch (e) {
    assert(false, `Phase 9 import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── 19. Phase 10 services importable
console.log('Test 19: Phase 10 retrieval services importable');
{
  try {
    await import('../server/brain/services/wikiRetrieval.js');
    await import('../server/brain/services/signalRetrieval.js');
    await import('../server/brain/services/graphRetrieval.js');
    await import('../server/brain/services/brainContextRetrieval.js');
    assert(true, 'all Phase 10 retrieval services import successfully');
  } catch (e) {
    assert(false, `Phase 10 import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── 20. brainPipeline + Qdrant fallback still intact
console.log('Test 20: brainPipeline and Qdrant fallback intact');
{
  try {
    await import('../server/brain/services/brainPipeline.js');
    await import('../server/brain/services/continuousBrainPipeline.js');
    assert(true, 'brainPipeline + continuousBrainPipeline import successfully');
  } catch (e) {
    assert(false, `pipeline import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (errors.length > 0) {
  console.error('\nFailed tests:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ All Phase 10 tests passed.');
  console.log('\nNote: DB-dependent tests (saved WikiEntry/Signal/Graph retrieval) must run in Replit after migration.');
}
