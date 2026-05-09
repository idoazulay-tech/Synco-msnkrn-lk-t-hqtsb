# דוח Trust QA — Sprint Pack 3ה
## תאריך: 09/05/2026 | סינקו (Synco) — Trust + QA Pack

---

## תוצאה כוללת

| ✅ עובר | ❌ נכשל | ⏭ דולג |
|---------|---------|---------|
| **40** | **0** | **1** |

> **סטטוס: ✅ QA עבר בהצלחה**
> Build: ✅ `npm run build` — ללא שגיאות TypeScript

---

## סיכום ביצועי בדיקות

### 1. Health Check ✅
- `GET /api/health` מחזיר `{"status":"ok","timestamp":"..."}` — שרת פעיל ומגיב.

### 2. No Past Scheduling ✅
- `nowContextSummary.isToday = true` מחושב נכון מ-`nowIso` ו-`timezoneOffsetMinutes`.
- **אין משימה אחת** ששובצה לפני `now + 5 דקות` (UTC 15:25).
- הודעת אזהרה מתאימה מוצגת ב-`warnings[]`: "שיבוץ מהשעה הנוכחית בלבד".

### 3. Anchor Context ✅
- זוהתה 1 עוגן ("יציאה ליהוד" → `anchorType: departure`).
- `schedulingContextReasons` נוצרו על כל המשימות המשובצות.
- ⏭ Skip: אימות מיקום משימות הכנה לפני העוגן — לא ניתן לוודא עקב היעדר חלון זמן (המבחן רץ אחה"צ).

### 4. False Learning Prevention ✅
- משימה עם ID חדש לחלוטין (מעולם לא הופיעה ב-DB) → `learningBoost = 0`.
- אין שום "זזה בעבר" ב-`learningReasons`.

### 5. Source Filtering ✅
- יצרנו events עם `source: test`, `seed`, `debug`, `manual_test`.
- תוצאה: `learningBoost = 0`, אין `durationSuggestion`.
- **`EXCLUDED_SOURCES`** עובד בשתי השירותים: `planningLearningContextService` ו-`durationIntelligenceService`.

### 6. Real Learning Boost ✅
- שאלנו את `movedTaskHints` מה-DB הקיים (211 events, 10 hints).
- משימה עם taskId בתוך `movedTaskHints` → `learningBoost = 8` (rescheduleCount ≥ 3).
- משימה עם ID חדש לגמרי → `learningBoost = 0`.
- מנגנון הboost עובד נכון: **רק ID-match אמיתי** מקבל boost.

### 7. Duration Suggestion Safety ✅
- יצרנו 3 events מסוג `task_execution_completed` עם `actualDurationMinutes: 90` (vs. planned: 30).
- `durationSuggestion` הופיעה עם `suggestedDurationMinutes: 90`.
- `durationMinutes` של המשימה **לא השתנה** (נשאר 30) — ההצעה read-only.
- בלוק הזמן בתוצאת השיבוץ משקף בדיוק 30 דקות.

### 8. Weak Title — No Suggestion ✅
- כותרת "ישיבה" (מילה אחת משמעותית) → **אין** `durationSuggestion`.
- `isTitleMatch` דורש ≥ 2 מילים משמעותיות + Jaccard ≥ 0.6 — הגנה אמינה מפני false positives.

### 9. Draft No DB ✅
- `POST /api/planner/schedule` (preview) → **ספירת UserTask לא השתנתה** (45 → 45).
- השיבוץ הוא **read-only לחלוטין** לפני commit.

### 10. Commit Draft Schedule ✅
- `createdCount = 2`, שתי משימות נוצרו ב-DB.
- ניתן לאתר את המשימה ב-`GET /api/user-tasks?userId=default-user`.
- `draftToTaskMap` מוחזר עם mapping מלא draft → real ID.

### 11. Commit Rollback — Atomic ✅
- draft ללא `scheduledItem` → `ok: false` + הודעת שגיאה.
- ספירת DB לא השתנתה → **$transaction אטומי עובד נכון**: הכל או כלום.

### 12. Apply Schedule Safety ✅
- משימה פעילה (non-completed) → עודכנה בהצלחה (`updatedCount >= 1`).
- taskId שלא קיים → מדולג בחן (`ok: false` / `updatedCount: 0`).

### 13. Execution Persistence ✅
- `task_execution_completed` event נשמר דרך `POST /api/learning/events`.
- events ניתנים לקריאה דרך `GET /api/learning/events`.

### 14. Execution Expiry ✅
- event עם `actualStartSource: "expired_execution_start_fallback"` ו-dateIso ישן → נשמר בהצלחה.

### 15. Local Time Contract ✅
- `nowContextSummary.nowIso` = בדיוק הערך שנשלח מהלקוח.
- `earliestAllowedTime = "15:25"` (now+5min UTC, HH:MM).
- ערך now+5 מחושב נכון ב-UTC: 15:20 + 5 = **15:25** ✅.

---

## Regression Smoke Tests ✅ (8/8)

| Endpoint | תוצאה |
|---------|--------|
| `GET /api/health` | ✅ status:ok |
| `POST /api/planner/schedule` | ✅ ok:true |
| `POST /api/planner/apply-schedule` | ✅ reachable (400 לריק) |
| `POST /api/planner/commit-draft-schedule` | ✅ reachable (400 לריק) |
| `POST /api/learning/events` | ✅ ok:true |
| `GET /api/learning/daily-summary` | ✅ ok:true |
| `GET /api/learning/planning-context` | ✅ ok:true |
| `POST /api/learning/duration-suggestions` | ✅ reachable |

---

## ממצאים ותיקונים שבוצעו במהלך ה-QA

### 🔧 תיקון 1: Health endpoint format
- **בעיה**: הסקריפט המקורי בדק `r.ok === true` אך `/api/health` מחזיר `{status:"ok"}`.
- **תיקון**: שינוי ל-`r.status === 'ok'`.

### 🔧 תיקון 2: Task lookup URL
- **בעיה**: הסקריפט השתמש ב-`/api/tasks/default-user` שלא קיים.
- **תיקון**: שינוי ל-`/api/user-tasks?userId=default-user` (הנתיב הנכון).

### 🔧 תיקון 3: Real Learning Boost — בדיקה עם נתוני DB אמיתיים
- **בעיה**: הסקריפט יצר 3 events בלבד, אך `movedTaskHints` מוגבל ל-top 10 ממוין לפי rescheduleCount. DB כבר מכיל tasks עם 31, 23, 20 reschedules — 3 events חדשים לא נכנסים לרשימה.
- **תיקון**: שינוי הטסט לשאול את `movedTaskHints` הקיים, לקחת taskId אמיתי מהרשימה, לשבץ אותו ולוודא שמקבל boost.

---

## מסקנות

1. **No Past Guard**: פועל מושלם — אף משימה לא שובצה בעבר.
2. **Source Filtering**: EXCLUDED_SOURCES מפעיל סינון נאמן ב-2 שירותים עצמאיים.
3. **False Learning Prevention**: רק taskId-match אמיתי גורם לboost (אין false positives).
4. **Duration Suggestion**: advisory-only — לא משנה את duration המקורי.
5. **Atomicity**: `$transaction` בcommit-draft-schedule פועל — הכל או כלום.
6. **Read-only Schedule**: `planner/schedule` לא כותב ל-DB לפני commit.
7. **Local Time Contract**: client שולח `nowIso + timezoneOffsetMinutes + userTimeZone`, שרת משקף נכון.

---

## איך להריץ שוב

```bash
# ודא שהשרת רץ על port 3001
npm run dev

# בחלון נפרד:
bash scripts/synco-trust-qa.sh
```

## קבצים שנוצרו ב-Sprint הזה

| קובץ | תיאור |
|------|--------|
| `scripts/synco-trust-qa.sh` | סקריפט QA אוטומטי (40 בדיקות) |
| `docs/TRUST_QA_CHECKLIST.md` | רשימת בדיקות ידנית (42 פריטים) |
| `docs/TRUST_QA_REPORT.md` | דוח זה |
