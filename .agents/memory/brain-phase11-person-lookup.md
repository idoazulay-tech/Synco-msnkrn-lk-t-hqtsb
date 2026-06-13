---
name: Brain Phase 11 — Person Context Lookup
description: Quick route person deduplication logic and continuousContext in devMode
---

## Person Lookup (quick.ts) — dual strategy
Two mechanisms run in parallel, both must suppress known-person questions:

1. **Direct GraphNode query** (non-blocking try-catch before brainResultPromise):
   - `prisma.graphNode.findMany({ where: { userId, nodeType: 'person' } })`
   - Builds `allKnownPersonLabels: string[]` — ALL known persons, not just participants
   - On failure: empty array (non-blocking)

2. **checkKnownEntities** (inside brainResultPromise Promise.all):
   - `checkKnownEntities(resolvedUserId, cleanParticipantNames)` — checks ruleEngine-extracted names
   - Results merged into `knownEntityNames` Set along with `allKnownPersonLabels`

`knownEntityNames` Set is passed to `runBrainPipeline` to suppress questions in brainPipeline step 3.
Entity questions from quick.ts also filtered using `knownEntityNames`.

**Why:** ruleEngine may not extract every person mentioned; direct GraphNode query catches ALL known persons.
Without this, brainPipeline generates "מי זה X?" for known persons not in cleanParticipantNames.

## Two sources of "מי זה X?" questions — BOTH must be filtered
1. quick.ts entity questions: `cleanParticipantNames.filter(name => !knownEntityNames.has(...))`
2. brainPipeline.ts Step 3: filters questions where `relatedEntityName` is in `knownEntityNames`

## _brain.continuousContext in devMode
- Only appears in devMode (X-Synco-Dev: 1 header) on TASK_CREATED path
- Synchronous IIFE calling `runContinuousBrainFromText(userId, text, 'quick_input', { knownEntities: allKnownPersonLabels })`
- Merged into `_brain` response: `{ ...brainResult, continuousContext }`
- Shape: `{ ok: boolean, signals: Signal[], diagnostics: string[], ... }` — full ContinuousBrainResult

## Test inputs that guarantee TASK_CREATED (not PENDING)
- "שיחה עם X מחר בשלוש" → time=15:00 → TASK_CREATED
- "שיחה עם X מחר בחמש" → time=17:00 → TASK_CREATED
