---
name: Brain Retrieve Layer (Phase 10)
description: GET /api/brain/retrieve endpoint design, graphSummary signature, and test-compat fields
---

## Endpoint: GET /api/brain/retrieve
- Now uses `retrieveContinuousBrainContext` (brainContextRetrieval.ts) — NOT direct Prisma queries
- Params: `userId` (required), `query` (required), `devMode` (optional boolean string)
- Returns: `{ ok, query, userId, totalResults, sources, message, signals[], wikiEntries[], graphNodes[], graphContext?, diagnostics? }`
- `diagnostics[0]` when devMode=true MUST start with `retrieve: userId=..., query="..."` (Phase 10 test assertion)
- 400 on missing userId or query

## Full field sets required (Phase 10 test-compat)
- `signals[]`: id, signalType, title, summary, confidence, shouldCreateTask, shouldUpdateWiki, shouldUpdateGraph, sensitivityLevel, createdAt
- `wikiEntries[]`: id, topic, summary, keyPoints, sourceSignalIds, confidence, sensitivityLevel, updatedAt
- `graphNodes[]`: id, nodeType, label, confidence, sensitivityLevel, createdAt
- Underlying services (signalRetrieval, wikiRetrieval, graphRetrieval) return full rows — map all fields.

## graphSummary signature
`graphSummary(nodes: number, edges: number)`
- nodes>0 and edges>0 → "הוספתי N צמתים ו-E קשרים לגרף האישי."
- nodes>0, edges=0 → "הוספתי N פריטים לגרף האישי."
- edges>0, nodes=0 → "הוספתי E קשרים לגרף האישי."

**Why:** Phase 10 tests (64 assertions) check both field presence and wording.
Call site: brain.ts ~line 192: `graphSummary(persisted.graphNodesCount, persisted.graphEdgesCount)`
