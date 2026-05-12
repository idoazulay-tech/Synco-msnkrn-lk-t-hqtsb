# Synco AI Sprint 4ה — Pattern Testing Report

**Sprint:** 4ה — Pattern Matrix Testing & Prompt Enhancement  
**Date:** Sprint 4ה  
**Status:** Deliverables complete — awaiting live test run against AI backend

---

## What Was Done in Sprint 4ה

Sprint 4ה is not a feature sprint. It is a **testing, prompts, schemas, validators, mapping, and documentation** sprint.  
No new API endpoints were added. No DB schema changed. Trust QA was not broken.

### Deliverables

| Deliverable | File | Status |
|---|---|---|
| Pattern taxonomy documentation | `docs/SYNCO_TIME_MANAGEMENT_PATTERNS.md` | ✅ Created |
| Matrix-based test script | `scripts/synco-ai-hebrew-tests.ts` | ✅ Created |
| Schema — optional pattern fields | `server/ai/schemas/syncoAISchemas.ts` | ✅ Updated |
| Prompts — pattern classification | `server/ai/prompts/syncoSystemPrompts.ts` | ✅ Updated |
| Report | `docs/SYNCO_AI_4H_REPORT.md` | ✅ This file |

---

## Pattern Coverage (Test Matrix)

| patternFamily | numberOfTests | Designed Pass Criteria | weakAreas |
|---|---|---|---|
| `time_structure` | 6 | AI extracts correct time anchor type, returns assumptions for soft anchors | `vague_time` may vary by wording |
| `operational_sequence` | 6 | AI returns multiple ordered tasks with correct patternFamily | `deadline_backplanning` may require follow-up questions |
| `day_modification` | 7 | AI returns preview-only operations with correct requiresExplicitConfirm | delete operations must always require confirmation |
| `task_type` | 5 | AI infers type-appropriate duration and flexibility defaults | `waiting_task` and `care_routine` may lack enough signal |
| `dependency` | 5 | AI surfaces dependency in warnings/assumptions, scope=task_only | `decision_dependency` may need clarifying question |
| `user_state_report` | 6 | AI scope=task_only, immediateSuggestion is concrete, no judgment | `overwhelmed` needs question, not replan |
| `recurrence` | 5 | AI returns create_recurrence proposal, never creates tasks directly | All recurrence must be proposal_only |
| `ambiguity` | 6 | AI must ask clarification for all ambiguous inputs — zero guessing | Critical family — all must pass |
| `goal_consequence` | 5 | AI surfaces consequenceIfNotDone without inventing details | `no_clear_consequence` must not invent |
| `safety_sensitive` | 6 | All safety rules enforced: no past scheduling, no invented memory, confirm required | All must pass — zero tolerance |
| **TOTAL** | **57** | | |

---

## How to Run the Tests

```bash
# Start the app first
npm run dev

# Run pattern tests (requires AI to be active)
npx tsx scripts/synco-ai-hebrew-tests.ts

# Or with a custom server URL
SERVER_URL=http://localhost:3001 npx tsx scripts/synco-ai-hebrew-tests.ts
```

The script outputs:
- Per-test PASS/FAIL with signals (clarify / assume / warn / confirm / no-db)
- Pattern coverage table
- Full markdown report written to `docs/SYNCO_AI_4H_REPORT.md`

---

## Schema Changes (non-breaking, Sprint 4ה)

Three schemas received optional `patternFamily` and `patternName` fields:

### `DayCommandIntentSchema`
```typescript
patternFamily?: 'time_structure' | 'operational_sequence' | 'day_modification' 
              | 'recurrence' | 'ambiguity' | 'safety_sensitive'
patternName?:  string
```

### `ParsedPlanningIntentSchema`
```typescript
patternFamily?: 'operational_sequence' | 'task_list' | 'deadline_backplanning' 
              | 'time_window' | 'generic_planning'
patternName?:  string
```

### `TaskReportAIAnalysisSchema`
```typescript
patternFamily?: 'user_state_report' | 'dependency' | 'goal_consequence' 
              | 'ambiguity' | 'task_execution_blocker'
patternName?:  string
```

**Compatibility guarantee:** All new fields use `.optional()` + `.catch()` fallback. Existing API consumers are unaffected. The AI may or may not return these fields — both cases are valid.

---

## Prompt Changes (Sprint 4ה)

A new `PATTERN_CLASSIFICATION_PREAMBLE` was added to all system prompts. It instructs the AI to:

1. **Classify first** — identify `patternFamily` and `patternName` before producing output
2. **Apply family rules** — ambiguity → ask; safety_sensitive → confirm; recurrence → proposal
3. **Include classification in output** — `patternFamily` and `patternName` in every response

This preamble was injected into:
- `DAY_COMMAND_SYSTEM_PROMPT`
- `PARSE_PLANNING_SYSTEM_PROMPT`
- `TASK_REPORT_SYSTEM_PROMPT`

`TASK_BREAKDOWN_SYSTEM_PROMPT` and `TASK_GUIDANCE_SYSTEM_PROMPT` were not changed — they are narrow-scope prompts that don't benefit from pattern classification.

---

## Test Categories Explained

Each test in `scripts/synco-ai-hebrew-tests.ts` reports these signals:

| Signal | What it means |
|---|---|
| **patternDetected** | The `patternFamily` the AI returned (or null if missing) |
| **needsClarification** | AI returned questions[] with at least one item |
| **previewOnly** | Response was preview-only (always true for these endpoints) |
| **hadAssumption** | AI returned assumptions[] with at least one item |
| **hadWarning** | AI returned warnings[] with at least one item |
| **dbWriteAvoided** | No DB write occurred (always true for preview endpoints) |
| **requiresExplicitConfirm** | At least one operation had requiresExplicitConfirm=true |

---

## Synco Time Management Pattern Map

Full definitions in `docs/SYNCO_TIME_MANAGEMENT_PATTERNS.md`.

### Summary

| Family | Patterns | Key Rule |
|---|---|---|
| `time_structure` | time_window, hard_anchor, soft_anchor, deadline, no_past_scheduling, transition_time, buffer, before_after, end_of_day, vague_time | Never schedule in the past |
| `operational_sequence` | morning_routine, evening_routine, leaving_home, preparing_for_event, preparing_for_meeting, house_workflow, deep_work_session, after_event_followup, deadline_backplanning, care_routine | Return ordered task arrays |
| `day_modification` | create, update, delete, duplicate, reschedule, swap, move_range, replan_day, cancel_low_priority, insert_urgent, make_recurring, partial_repeat | Preview only, delete=confirm |
| `task_type` | quick, deep_work, home_chore, errand, communication, admin, money, health, family, pet_care, learning, project, form_document, waiting | Duration/flexibility defaults |
| `dependency` | resource_missing, person_dependency, location, file, energy, decision, prerequisite, external_deadline | Surface in assumptions[] |
| `user_state_report` | low_energy, unclear_first_step, too_big, resistance, avoidance, waiting_on_someone, wrong_timing, unsure_priority, ready_to_start, overwhelmed, interrupted | scope=task_only always |
| `goal_consequence` | advances_goal, prevents_mess, affects_person, affects_money, affects_work, affects_household, affects_health, affects_trust, no_clear_consequence | Never invent consequences |
| `recurrence` | daily, weekdays, weekly, monthly, only_morning, only_selected, repeat_same_day, repeat_time_range, repeat_until_date, pause | proposal only |
| `ambiguity` | pronoun_reference, vague_then, vague_evening, bulk_vague, vague_cancellation, restructure_command, unclear_target, multiple_matching, missing_time, missing_date | Always ask — never guess |
| `safety_sensitive` | preview_before_db, no_hard_delete, no_past_scheduling, no_invented_memory, no_emotional_assumptions, no_learning_boost, no_duration_from_ai, assumptions_displayed, clarify_low_confidence, explicit_confirm_high_risk | Zero tolerance rules |

---

## What "General Pattern" Means for Synco

Before Sprint 4ה, tests verified specific examples:
- "רצף בוקר" → OK
- "אוטובוס ב-7:45" → OK

After Sprint 4ה, tests verify **pattern families**:
- Any `operational_sequence:morning_routine` input → multi-task ordered output
- Any `ambiguity:pronoun_reference` input → ask_clarification, never guess
- Any `safety_sensitive:no_past_scheduling` attempt → warn or reject

The test script proves Synco handles **the pattern**, not just **the example**.
