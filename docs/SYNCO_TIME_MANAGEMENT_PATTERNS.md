# Synco Time Management Pattern Map
**Version:** 4ה | **Last Updated:** Sprint 4ה  
**Purpose:** This document defines the 10 pattern families that Synco's AI layer must recognize and classify before producing intent/operations. Every input example is a *specific case* of a *general pattern* — Synco must understand the pattern, not memorize the example.

---

## How to Use This Document

1. **AI prompts** use `patternFamily` and `patternName` to instruct the model to classify before acting.
2. **Test scripts** use this taxonomy as the source-of-truth matrix — each test maps to a family + name.
3. **Validators** use `patternFamily` as a soft signal for additional safety checks.
4. **Schema fields** `patternFamily` and `patternName` are optional, non-breaking additions to AI output.

---

## 1. Time Structures — `time_structure`

These are the fundamental building blocks of how Synco interprets temporal expressions in Hebrew.

| patternName | Description | Hebrew Examples | Safe Default |
|---|---|---|---|
| `time_window` | A time range without a fixed start/end | "בין 10 ל-12", "שעתיים אחה"צ" | Treat as soft anchor |
| `hard_anchor` | A precise, externally fixed time (meetings, transport) | "הטיסה ב-14:30", "הפגישה ב-9" | flexibility=fixed |
| `soft_anchor` | A preferred time, not externally fixed | "אני מעדיף בוקר", "בסביבות הצהריים" | flexibility=flexible |
| `deadline` | Latest possible completion time | "עד שישי", "לפני שאצא" | Set endTime constraint |
| `no_past_scheduling` | Cannot schedule in the past | "ב-8 בבוקר" when it's 10:00 | Reject, ask for new time |
| `transition_time` | Travel/setup time between tasks | "צריך 30 דקות נסיעה", "לפני הפגישה" | Add buffer task |
| `buffer` | Intentional empty time between tasks | "תשאיר לי זמן בין פגישות" | Add spacing |
| `before_after` | Relative to another task | "אחרי ארוחת הצהריים", "לפני הטיסה" | Requires anchor task |
| `end_of_day` | The tail of the working day | "בסוף היום", "לפני שאני הולך הביתה" | Map to dayEnd setting |
| `vague_time` | Ambiguous — cannot be scheduled without clarification | "כשיהיה לי זמן", "אחר כך" | Ask clarification |

---

## 2. Operational Sequences — `operational_sequence`

Multi-step real-world routines that Synco should recognize as a unit, not as isolated tasks.

| patternName | Description | Hebrew Examples | Notes |
|---|---|---|---|
| `morning_routine` | Regular morning task sequence | "בוקר שגרתי — קפה, אימון, מקלחת" | Sequential, soft timing |
| `evening_routine` | End-of-day wind-down sequence | "ערב: לבדוק מיילים, לאכול, שעת שינה" | Sequential |
| `leaving_home` | Pre-departure checklist | "לפני שאצא — תיק, מפתחות, ילדים" | Hard deadline trigger |
| `preparing_for_event` | Setup tasks before a scheduled event | "לפני הכנס — הדפסה, נסיעה, רישום" | Anchor=event time |
| `preparing_for_meeting` | Meeting readiness tasks | "לפני הפגישה עם X — לקרוא את החומר" | Anchor=meeting time |
| `house_workflow` | Home maintenance task chain | "שבת: כביסה, קניות, ניקיון" | Flexible ordering |
| `deep_work_session` | Focused, uninterrupted work block | "שעתיים בלי הפרעות לכתיבה" | No multitasking flag |
| `after_event_followup` | Post-event tasks | "אחרי הפגישה — סיכום, מיילים" | Trigger=event end |
| `deadline_backplanning` | Working backwards from a deadline | "הדו"ח ביום ד' — מה צריך לפניו?" | Requires deadline anchor |
| `care_routine` | Recurring care for a person/pet | "כדורים לסבתא בבוקר", "האכלת הכלב" | Daily recurring |

---

## 3. Day Modification Commands — `day_modification`

Explicit user instructions to alter the existing schedule. All produce **preview only** — no DB writes without confirmation.

| patternName | Description | Hebrew Examples | Safety Rule |
|---|---|---|---|
| `create_task` | Add a new task to the day | "הוסף לי פגישה ב-15:00" | preview only |
| `update_task` | Modify an existing task's properties | "שנה את הפגישה לשעה וחצי" | requiresExplicitConfirm if time changes |
| `delete_task` | Remove a task from the day | "מחק את פגישת הצהריים" | requiresExplicitConfirm=true always |
| `duplicate_task` | Copy a task to another day/time | "שכפל את זה למחר" | preview only |
| `reschedule_task` | Move a task to a different time | "הזז את X ל-16:00" | no past scheduling |
| `swap_tasks` | Exchange time slots of two tasks | "החלף בין X לבין Y" | preview + confirm |
| `move_range` | Shift all tasks in a time range | "הזז את כל אחה"צ שעה קדימה" | preview only |
| `replan_day` | Full day restructure | "תכנן לי מחדש את היום" | no fixed-task changes |
| `cancel_low_priority` | Remove all low-priority tasks | "בטל את כל מה שלא דחוף" | requiresExplicitConfirm=true |
| `insert_urgent_task` | Force a new urgent task into schedule | "נכנסה לי עבודה דחופה ב-13:00 לשעה" | triggers replan |
| `make_recurring` | Create a recurrence rule for a task | "תעשה את זה כל יום" | proposal only |
| `partial_repeat` | Repeat only selected tasks from a day | "קח רק את אותה שגרת בוקר" | proposal only |

---

## 4. Task Types — `task_type`

Categories that help Synco estimate duration, priority defaults, and scheduling strategy.

| patternName | Default Duration | Flexibility | Notes |
|---|---|---|---|
| `quick_task` | 5–15 min | anytime | "לשלוח מייל אחד", "לחתום על מסמך" |
| `deep_work` | 90–120 min | flexible | Needs quiet block, no interruptions |
| `home_chore` | 20–45 min | flexible | "כביסה", "שואב אבק" |
| `errand` | 30–60 min | fixed (transport) | "לסיים בבנק", "לאסוף חבילה" |
| `communication_task` | 15–30 min | flexible | "להתקשר ל-X", "לענות על וואטסאפ" |
| `admin_task` | 20–45 min | flexible | "לסדר נייר עבודה", "להגיש טופס" |
| `money_task` | 30–60 min | flexible | "לשלם חשבונות", "לבדוק חשבון בנק" |
| `health_task` | varies | fixed if appointment | "טיפול שיניים", "אימון", "כדורים" |
| `family_task` | varies | fixed (pickup/dropoff) | "לאסוף את הילדים ב-16:00" |
| `pet_care_task` | 15–30 min | soft | "הליכה עם הכלב", "האכלה" |
| `learning_task` | 30–60 min | flexible | "לקרוא פרק", "קורס מקוון" |
| `project_task` | 45–90 min | flexible | Requires context, deep focus |
| `form_document_task` | 20–60 min | flexible | "למלא טופס", "לסרוק מסמך" |
| `waiting_task` | unknown | fixed start | "להמתין לטכנאי בין 10–12" |

---

## 5. Dependencies — `dependency`

Blockers that prevent a task from starting or completing. Synco must surface these in `assumptions` or `questions`, never invent them.

| patternName | Description | Hebrew Examples | Synco Response |
|---|---|---|---|
| `resource_missing` | Needs a physical item not yet available | "צריך את הדו"ח של אנה" | Ask if resource exists |
| `person_dependency` | Blocked waiting on another person | "ממתין לאישור של המנהל" | Flag in warnings |
| `location_dependency` | Must be at a specific place | "רק אפשר לעשות בסניף" | Check if travel needed |
| `file_document_dependency` | Needs a file/document first | "צריך את הטופס לפני" | Surface as assumption |
| `energy_dependency` | Needs high energy state | "זה משימה ל-full focus" | Suggest morning slot |
| `decision_dependency` | Blocked by an unresolved decision | "לא יודע אם להמשיך עם X" | Ask clarification |
| `prerequisite_task` | Another task must complete first | "רק אחרי שמישהו אחר יסיים" | Order tasks |
| `external_deadline` | Deadline set by outside party | "הגשה ביום ד' — לא ניתן לדחות" | Mark as hard_anchor |

---

## 6. User State Reports — `user_state_report`

What users say when they report about a task in progress or blocked. Always `scope=task_only`. No pattern inference about the user as a person.

| patternName | Hebrew Example | Synco Response |
|---|---|---|
| `low_energy` | "אין לי כוח לזה עכשיו" | Suggest reschedule, ask when energy is better |
| `unclear_first_step` | "לא יודע מאיפה להתחיל" | Trigger breakdown |
| `task_too_big` | "זה גדול עלי" | Trigger breakdown or split |
| `resistance` | "אני נמנע מזה" | Surface immediateSuggestion, no judgment |
| `avoidance` | "כל הזמן אני דוחה את זה" | Note as assumption, don't generalize |
| `waiting_on_someone` | "ממתין לתשובה" | Mark dependency, suggest follow-up |
| `wrong_timing` | "זה לא הזמן הנכון" | Ask for preferred time |
| `unsure_priority` | "לא בטוח כמה זה דחוף" | Ask priority question |
| `ready_to_start` | "מוכן להתחיל, פשוט צריך צעד ראשון" | Surface firstStep immediately |
| `overwhelmed` | "יותר מדי דברים בו-זמנית" | Ask which task matters most right now |
| `interrupted_by_urgent` | "נכנסה לי עבודה דחופה" | Trigger insert_urgent_task preview |

---

## 7. Goal and Consequence Patterns — `goal_consequence`

Why a task matters. Synco uses these to generate `taskMeaning` and `consequenceIfNotDone` — never invented, only surfaced when evident from context.

| patternName | Description | Hebrew Examples |
|---|---|---|
| `advances_goal` | Task progresses a stated personal goal | "זה חלק מהפרויקט החשוב" |
| `prevents_mess_later` | Task prevents future problems | "אם לא אעשה את זה, יהיה בלאגן" |
| `affects_another_person` | Outcome affects someone else | "אם לא, אנה תחכה לי" |
| `affects_money` | Financial consequence | "אם לא אשלם — קנס" |
| `affects_work` | Work/career consequence | "הלקוח מחכה לזה" |
| `affects_household` | Home or family consequence | "אם לא אקנה — אין אוכל הערב" |
| `affects_health` | Health consequence | "התרופה חייבת להיות בזמן" |
| `affects_trust_responsibility` | Trust or responsibility at stake | "נתתי מילה שיהיה מוכן" |
| `no_clear_consequence` | No clear consequence identified | — | Return immediateSuggestion based on task type, not invented consequence |

---

## 8. Recurrence Patterns — `recurrence`

Rules for tasks that repeat. All recurrence operations are **proposals only** — Synco never creates hundreds of tasks without confirmation.

| patternName | Description | Hebrew Examples |
|---|---|---|
| `daily` | Every calendar day | "כל יום", "יומי" |
| `weekdays` | Monday–Friday only | "כל יום חול", "בימי עבודה" |
| `weekly` | Same day each week | "כל יום ד'", "כל שבוע ביום שלישי" |
| `monthly` | Same date each month | "כל ראשון לחודש", "כל חמישי בסוף חודש" |
| `only_morning_tasks` | Recur but only before noon | "רק משימות הבוקר בכל יום" |
| `only_selected_tasks` | Recur specific tasks, not all | "רק את הפגישה הזו כל שבוע" |
| `repeat_same_day` | Replicate today's full schedule | "חזור על היום הזה מחר" |
| `repeat_time_range` | Recur all tasks in a time window | "שגרת הבוקר כל יום — 7–9" |
| `repeat_until_date` | Recurring until a specific end date | "כל יום עד שישי" |
| `pause_recurrence` | Temporarily stop a recurring task | "השהה את זה לשבוע הבא" |

---

## 9. Ambiguity Patterns — `ambiguity`

Inputs Synco must **never guess at** — always ask a clarifying question. These are the most critical patterns for Trust and Safety.

| patternName | Hebrew Example | Required Action |
|---|---|---|
| `pronoun_reference` | "תזיז את **זה**" | Ask: "למה התכוונת?" |
| `vague_then` | "**אחר כך**" | Ask: "מתי בדיוק?" |
| `vague_evening` | "**בערב**" — could be 17:00–22:00 | Ask: "מה השעה המועדפת?" |
| `bulk_vague` | "**כל הדברים**", "כל המשימות" | Ask: "אתה מתכוון לכולן?" |
| `vague_cancellation` | "**מה שלא חשוב**" | Ask: "מה בדיוק לבטל?" |
| `restructure_command` | "**תסדר לי** את הערב" | Ask: "לפי איזו עדיפות?" |
| `unclear_target` | Target task not identifiable | commandType=ask_clarification |
| `multiple_matching_tasks` | Two tasks named "פגישה" | Ask: "לאיזו פגישה התכוונת?" |
| `missing_time` | Task mentioned without any time | Ask or default based on task type |
| `missing_date` | "מחר", "בשבוע הבא" without date context | Compute from dateIso, confirm |

---

## 10. Trust and Safety Patterns — `safety_sensitive`

Non-negotiable rules. These are **hard constraints** baked into every prompt layer, validator, and schema. Synco must never violate these, regardless of how clear or confident the input seems.

| patternName | Rule | Enforcement Layer |
|---|---|---|
| `preview_before_db` | AI outputs are preview only — never auto-applied | Validator + Route handler |
| `no_hard_delete` | delete_task requires requiresExplicitConfirm=true | Validator |
| `no_past_scheduling` | reschedule cannot place tasks before now | Validator (checks nowIso) |
| `no_invented_memory` | AI cannot claim to "remember" past behavior | Prompt + Validator |
| `no_emotional_assumptions` | Never infer emotions without explicit user statement | Prompt + Schema (scope=task_only) |
| `no_learning_boost` | AI cannot give motivational "boost" scores | Prompt |
| `no_duration_from_ai` | AI cannot suggest duration as if historical fact | Prompt |
| `assumptions_displayed` | All AI assumptions must appear in `assumptions[]` | Schema enforcement |
| `clarify_low_confidence` | confidence=low forces ask_clarification | Validator |
| `explicit_confirm_high_risk` | high-risk operations need requiresExplicitConfirm=true | Validator |

---

## Pattern Classification Guide for AI

When classifying input, the AI should follow this decision tree:

```
1. Is the input ambiguous (pronoun, vague time, unclear target)?
   → patternFamily = "ambiguity" → ask_clarification

2. Does the input contain a trust/safety trigger (delete, past time, bulk cancel)?
   → patternFamily = "safety_sensitive" → requiresExplicitConfirm=true

3. Is the input a modification of today's existing schedule?
   → patternFamily = "day_modification" → return operations[]

4. Is the input a multi-step real-world sequence?
   → patternFamily = "operational_sequence" → extract tasks in order

5. Is the input a user state report about a task in progress?
   → patternFamily = "user_state_report" → scope=task_only

6. Is the input a recurrence request?
   → patternFamily = "recurrence" → create_recurrence proposal only

7. Is the input a general planning/scheduling request?
   → patternFamily = "time_structure" or "operational_sequence"
   → extract tasks with anchors, assumptions, questions
```

---

## patternFamily Values by Schema

### DayCommandIntent
| patternFamily | Used When |
|---|---|
| `time_structure` | Scheduling around time anchors |
| `operational_sequence` | Multi-step routine |
| `day_modification` | Single operation on existing schedule |
| `recurrence` | Repeating task proposal |
| `ambiguity` | Unclear target or time |
| `safety_sensitive` | Delete, bulk cancel, past scheduling |

### ParsedPlanningIntent
| patternFamily | Used When |
|---|---|
| `operational_sequence` | Routine or sequence input |
| `task_list` | Simple list of tasks |
| `deadline_backplanning` | Working backwards from deadline |
| `time_window` | Time range scheduling |
| `generic_planning` | General planning input |

### TaskReportAIAnalysis
| patternFamily | Used When |
|---|---|
| `user_state_report` | Report on current task status |
| `dependency` | Blocked by something |
| `goal_consequence` | Context about why task matters |
| `ambiguity` | Unclear what was meant |
| `task_execution_blocker` | Specific blocker type |
