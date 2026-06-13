---
name: Brain Retrieve Layer (Phase 10)
description: GET /api/brain/retrieve endpoint design and graphSummary signature change
---

## Endpoint: GET /api/brain/retrieve
- Params: `userId` (required), `query` (required), `devMode` (optional boolean string)
- Searches: BrainSignal (signalType OR title OR summary), WikiEntry (topic), GraphNode (label OR nodeType)
- All searches are case-insensitive Prisma `contains`
- Returns: `{ ok, query, userId, totalResults, signals[], wikiEntries[], graphNodes[], diagnostics? }`
- devMode=true adds diagnostics[] string array
- 400 on missing userId or query

## graphSummary signature change
Old: `graphSummary(count: number)`
New: `graphSummary(nodes: number, edges: number)`
- edges=0 → "הוספתי N פריטים לגרף האישי."  (nodes only)
- edges>0 → "הוספתי N+edges קשרים לגרף האישי." (nodes + edges)

**Why:** "קשרים" (connections/edges) is semantically distinct from "פריטים" (items/nodes). 
**Call site:** brain.ts line ~192: `graphSummary(persisted.graphNodesCount, persisted.graphEdgesCount)`

## Test file
`scripts/test-phase10-retrieve.ts` — 64 assertions (20 test groups)
- Test 7 queries "commitment" (not Hebrew) because BrainSignal titles are English identifiers
