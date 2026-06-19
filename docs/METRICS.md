# Synco MVP Metrics

## What We Measure and Why

Synco's core promise is: **take the user from overwhelmed chaos to one completed action.**
These metrics prove whether we deliver on that promise.

---

## Core MVP Funnel

```
Intake Previewed
      ↓
Intake Committed
      ↓
Now Action Started
      ↓
Now Action Completed
      ↓
Next Action Clicked
```

### Tracked via LearningEvents

| Event Type             | What It Means                                               |
|------------------------|-------------------------------------------------------------|
| `intake_previewed`     | User submitted free-text; got back a structured preview     |
| `intake_committed`     | User confirmed the preview; tasks + projects saved to DB    |
| `now_action_started`   | User tapped "Start" on the recommended now action           |
| `now_action_completed` | User marked the now action as done                          |
| `now_action_stuck`     | User tapped "I'm stuck" on the now action                   |
| `now_action_skipped`   | User skipped the now action                                 |
| `next_action_clicked`  | User moved to the next recommended action                   |
| `reflection_shown`     | Reflection screen shown after completing a now action       |

---

## Activation Definition

A user is **activated** when they:
1. Create an intake (commit)
2. Start the recommended Now Action
3. Complete that Now Action

This sequence proves the core value loop: **chaos → organized → action taken.**

---

## Value Proof

> "User moved from chaos to completed action."

Metric: `chaos_to_action_completed` event count > 0 for a given userId.

A user who has this event has experienced the full Synco value loop at least once.

---

## Project Progress

A project tracks a multi-step goal created from intake.

| Field                | Definition                                        |
|----------------------|---------------------------------------------------|
| `totalSteps`         | Number of ProjectStep records                     |
| `completedSteps`     | Steps with status = 'completed'                   |
| `progressRate`       | completedSteps / totalSteps                       |
| `linkedTasks`        | UserTasks with projectId = this project           |
| `completedLinkedTasks` | Linked tasks with status = 'completed'          |
| `nextActionTitle`    | Title of first non-completed step                 |

---

## API Endpoints

### `GET /api/metrics/overview?userId=default-user`

```json
{
  "ok": true,
  "userId": "default-user",
  "totals": {
    "intakeCount": 5,
    "committedIntakeCount": 4,
    "projectCount": 8,
    "taskCount": 22,
    "completedTaskCount": 7,
    "nowActionStartedCount": 4,
    "nowActionCompletedCount": 3,
    "stuckCount": 1,
    "skippedCount": 0
  },
  "rates": {
    "intakeCommitRate": 0.8,
    "taskCompletionRate": 0.318,
    "nowActionCompletionRate": 0.75
  }
}
```

### `GET /api/metrics/funnel?userId=default-user`

```json
{
  "ok": true,
  "funnel": {
    "intakePreviewed": 10,
    "intakeCommitted": 8,
    "nowActionStarted": 6,
    "nowActionCompleted": 4,
    "nextActionClicked": 3
  },
  "conversionRates": {
    "previewToCommit": 0.8,
    "commitToStart": 0.75,
    "startToComplete": 0.667
  }
}
```

### `GET /api/metrics/projects?userId=default-user`

```json
{
  "ok": true,
  "projects": [
    {
      "projectId": "...",
      "title": "סידור בנק וחובות",
      "totalSteps": 5,
      "completedSteps": 2,
      "linkedTasks": 3,
      "completedLinkedTasks": 1,
      "progressRate": 0.4,
      "nextActionTitle": "לדרג את החובות לפי דחיפות ותאריך יעד"
    }
  ]
}
```

---

## Event Metadata Fields

All events include:

| Field       | Source                        |
|-------------|-------------------------------|
| `userId`    | Always present                |
| `eventType` | One of the taxonomy strings   |
| `source`    | 'intake', 'now', 'project'    |
| `taskId`    | Set when event is task-linked |
| `metadata`  | JSON — event-specific fields  |

`metadata` keys by event type:

**`intake_previewed`**
```
inputLength, nowActionTitle, projectCount, todayTaskCount,
laterTaskCount, noteCount, openQuestionCount, topicCount
```

**`intake_committed`**
```
intakeId, createdProjectCount, createdTaskCount,
createdStepCount, createdOpenQuestionCount, nowTaskId
```

**`project_created_from_intake`**
```
projectId, intakeId
```

---

## Retention Metrics (Future)

Track later:
- Days between first intake and second intake
- Weekly active sessions (sessions with at least one now_action_started)
- Project completion rate over 30 days
- Return rate after completing first now action

---

## Interpretation Guide

| Metric                  | Healthy Range | Action if Low                       |
|-------------------------|---------------|-------------------------------------|
| `intakeCommitRate`      | > 0.7         | Improve preview clarity / trust     |
| `taskCompletionRate`    | > 0.5         | Reduce task overload from intake    |
| `nowActionCompletionRate` | > 0.6      | Check if now actions are too hard   |
| `previewToCommit`       | > 0.7         | Improve preview UX / edit flow      |
| `commitToStart`         | > 0.6         | Strengthen post-commit now CTA      |
| `startToComplete`       | > 0.5         | Now actions may be too large        |
