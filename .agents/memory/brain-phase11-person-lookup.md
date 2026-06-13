---
name: Brain Phase 11 — Person Context Lookup
description: Quick route person deduplication logic and continuousContext in devMode
---

## Person Lookup (quick.ts)
- Runs after task creation (TASK_CREATED path only), before persistDeferredQuestions
- `prisma.graphNode.findMany({ where: { userId, nodeType: 'person' } })`
- On failure: knownPersonLabels = [] (non-blocking try-catch)
- Passed to BOTH: quick.ts entity filter AND runBrainPipeline(knownPersonLabels)

## Two sources of "מי זה X?" questions
1. quick.ts entity questions (lines ~305-309): filtered by `.filter(name => !knownPersonLabels.includes(...))`
2. brainPipeline.ts Step 3: `filteredQuestions` skips questions where relatedEntityName is known
Both must be filtered — filtering only one leaves duplicates.

**Why:** continuousBrain already has knownEntities suppression; quick route entity flow needed same.

## _brain.continuousContext
- Only appears in devMode (X-Synco-Dev: 1 header) on TASK_CREATED path
- runContinuousBrainFromText(userId, text, 'quick_input', { knownEntities: knownPersonLabels })
- Synchronous (not async) — IIFE with try-catch

## Test inputs that guarantee TASK_CREATED (not PENDING)
- "שיחה עם X מחר בשלוש" → date=tomorrow, time=15:00 → TASK_CREATED
- "שיחה עם X מחר בחמש" → date=tomorrow, time=17:00 → TASK_CREATED
- Inputs without time (e.g. "תחזור ל-X מחר") → PENDING_CREATED (no _brain returned)
