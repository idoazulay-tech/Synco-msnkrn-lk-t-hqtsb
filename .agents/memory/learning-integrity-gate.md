---
name: Learning Integrity Gate — Phase 1
description: Contextual duplicate detection for learning events before Qdrant writes; key design decisions and next phase prerequisites.
---

## Rule
`server/brain/services/learningIntegrityGate.ts` — `runContextualDuplicateGate(event)` runs AFTER `prisma.learningEvent.create()`, BEFORE the Memory Derivation Engine.

## Gate config
| eventType | windowMs | useDateIso |
|-----------|---------|-----------|
| task_completed | 3000 | true |
| task_execution_completed | 5000 | true |
| task_created | 3000 | false |

**useDateIso=true** means same taskId+eventType within window is only a duplicate when dateIso also matches — recurring-task completions on different dates are both accepted.

**Why:** `task_created` uses `useDateIso=false` because taskId is a client UUID unique per task instance — two creates of the same UUID are always spurious.

## Integration point in learning.ts
After `prisma.learningEvent.create()`, before derivation loop. Guarded by its own `{ }` block — independently removable.

## Feature flag
`SYNCO_INTEGRITY_GATE_ENABLED=false` → bypass entirely (instant rollback, no migration needed).

## Fail-open
Any Prisma error in gate query → `{ status: 'accepted', reason: 'gate_error_fail_open' }`. Never suppress real events due to DB errors.

## task_rescheduled
Not in GATE_CONFIG and not in derivation engine. Requires burst-collapse policy (Phase 3) before either gate or derivation applies.

## Phase 2 prerequisites (not yet implemented)
Add to `taskStore.ts → updateTask()` logLearningEvent call:
- `dateIso: (updates.startTime ?? previousTask.startTime).toISOString().split('T')[0]`
- `metadata.taskCreatedAt: previousTask.createdAt?.toISOString() ?? null`
These two fields are required for Phase 3 burst-collapse and initial-placement-refinement detection.

## Test results (confirmed passing)
- Gate diagnostics: 22/22
- Memory context: 20/20
- TypeScript: EXIT:0
