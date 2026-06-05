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

## Phase 3 next step
Build Reschedule Burst Collapse policy in `learningIntegrityGate.ts`:
- Group task_rescheduled events by (userId, taskId, dateIso) within a burst window (~30–60 min)
- Accept only the last movement in a burst; suppress intermediates
- Use metadata.taskCreatedAt to classify initial-placement-refinement separately from genuine rescheduling
