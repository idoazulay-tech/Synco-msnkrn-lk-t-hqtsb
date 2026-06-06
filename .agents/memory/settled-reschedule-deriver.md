---
name: Settled Reschedule Deriver
description: Phase 4a implementation decisions for writing factual Qdrant memories after reschedule bursts settle.
---

## Rule: settledMemoryWrittenAt AFTER Qdrant upsert only
Write the Postgres marker only after a successful storeUserMessage call.
A Qdrant failure must leave the event retry-eligible (marker absent).

**Why:** If the marker is written before Qdrant confirms, a future run skips the event and the memory is never written.

**How to apply:** Always `await storeUserMessage(...)` first; only then `await prisma.learningEvent.update(... settledMemoryWrittenAt ...)`.

## Rule: BURST_WINDOW_MS duplicated in settledRescheduleDeriver.ts
Both files use `5 * 60_000`. Not imported from rescheduleBurstDetector.ts to avoid circular imports.

**Why:** rescheduleBurstDetector → learning.ts → (potentially) settledRescheduleDeriver. Circular risk is real.

**How to apply:** If BURST_WINDOW_MS ever changes, update both files and grep for the value.

## Rule: Prisma JSON metadata filtering done in TypeScript
findSettledRescheduleEvents fetches by (userId, eventType, occurredAt < settledBefore) then filters burstRole/isInitialPlacementRefinement/settledMemoryWrittenAt in TypeScript code.

**Why:** Prisma has no safe typed JSON path query for arbitrary metadata fields. Raw SQL JSON path queries are brittle.

**How to apply:** Always fetch a bounded set (take: 200) and filter in TS.

## Rule: T7 idempotency is Qdrant-conditional
When Qdrant is unavailable, run 2 finds candidates=1 (correct retry behavior, not a bug).
Full idempotency (candidates=0 on rerun) only holds when Qdrant is live and writes succeed.

**Why:** The dedup guard is settledMemoryWrittenAt, which is written only on Qdrant success.

## Rule: isInitialPlacementRefinement=true → filtered at findSettledRescheduleEvents level
These events are excluded from candidates entirely, not processed with a skip marker.

**Why:** At fetch time we can filter them in TypeScript. No need to enter the processing loop.

## memoryKind: 'reschedule_settled'
Added to ApprovedLearningMemoryKind in learningMemoryDerivation.ts.
deriveFactualMemoriesFromLearningEvent still returns [] for task_rescheduled — unchanged.

## Forbidden words (never in memory text or metadata values)
דחה, נמנע, מתקשה, כשל, בעיה, דחיינות, procrastination, avoidance, postponement, planning_failure, delay_pattern

## Next phase (Phase 4b — not yet implemented)
Lazy auto-trigger: when a new task_rescheduled event arrives in learning.ts, call
processSettledReschedules for same (userId, taskId, dateIso) to catch prior settled finals.
Do NOT add until Phase 4a is proven stable in production.
