---
name: Reschedule Data Quality — Phase 2
description: task_rescheduled events now include dateIso and metadata.taskCreatedAt; prerequisites for Phase 3 burst-collapse policy.
---

## What was added (taskStore.ts → updateTask)
```typescript
dateIso: (updates.startTime ?? previousTask.startTime).toISOString().split('T')[0],
metadata: {
  duration, priority, flexibility,               // pre-existing
  taskCreatedAt: previousTask.createdAt?.toISOString?.() ?? null,  // NEW
},
```

**Why dateIso:** Phase 3 burst-collapse groups reschedule movements by calendar day. Without dateIso on the raw event, grouping requires a join back to the task record.

**Why taskCreatedAt:** Initial-placement-refinement detection (move within 5 min of task creation) needs the creation timestamp at query time. Without it, detecting this pattern requires a cross-event join.

## What is still excluded
- task_rescheduled is NOT in the Integrity Gate config (event_not_gated)
- task_rescheduled is NOT in the Derivation Engine (returns 0 memories)
- Zero Qdrant writes for reschedule events

## Phase 3 (DONE)
`server/brain/services/rescheduleBurstDetector.ts` — annotation only, zero Qdrant writes.
- BURST_WINDOW_MS = 300_000 (5 min); INITIAL_PLACEMENT_WINDOW_MS = 300_000
- burstRole: 'sole' | 'member' | 'final' — written into metadata: Json?
- isInitialPlacementRefinement: occurredAt - taskCreatedAt <= 5 min
- Feature flag: SYNCO_BURST_DETECTION_ENABLED=false → skip
- Called from learning.ts after integrity gate, before derivation loop
- Prior burst members retroactively set to burstRole='member' via updateMany
- All raw rows preserved; no behavioral conclusions; 28/28 diagnostics passed

## Phase 4 next step
Extend Derivation Engine to accept task_rescheduled with burstRole='final' and
isInitialPlacementRefinement=false, and produce one factual positional memory per burst.
Do NOT infer postponement/avoidance from any single burst.
