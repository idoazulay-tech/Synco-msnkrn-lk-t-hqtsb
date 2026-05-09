# רשימת בדיקות ידנית — Synco Trust QA
## Sprint Pack 3ה — Trust + Usability QA Pack

> בצע כל שלב לפי הסדר. סמן ✅ / ❌ / ⚠️ ליד כל פריט.

---

### חלק א: DayView ותצוגת משימות

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 1 | פתח `/day` | הדף נטען בלי שגיאות, מוצגת ציר הזמן | |
| 2 | צור משימה של **1 דקה** ב-DayView | בלוק מוצג במצב **micro** — title בלבד, ללא שעה | |
| 3 | צור משימה של **5 דקות** | מצב **micro** — title בלבד, גופן text-[8px] | |
| 4 | צור משימה של **10 דקות** | מצב **tiny** — שעת התחלה + title מקוצר | |
| 5 | צור משימה של **20 דקות** | מצב **compact** — title + שעות בשורה אחת | |
| 6 | צור משימה של **30 דקות** | מצב **compact** — title + שעות בשורה אחת | |
| 7 | צור משימה של **60 דקות** | מצב **full** — title בשורה, שעות מתחת, progress% אם פעיל | |
| 8 | בדוק שם ארוך (≥40 תווים) | הטקסט מקבל ellipsis (…), לא גולש מחוץ לקובייה | |
| 9 | בדוק שעברית מוצגת RTL | הכותרת מיושרת לימין, מספרי שעה משמאל (dir="ltr" על span) | |
| 10 | בדוק שטקסט לא גולש | overflow:hidden, white-space:nowrap, min-width:0 — טקסט לא עולה על משימות אחרות | |
| 11 | לחץ על משימה קצרה (micro/tiny) | נפתח TaskDetail מלא עם כל הפרטים | |
| 12 | בדוק Drag & Drop | גרור משימה לשעה אחרת — זמנים מתעדכנים, mode מתעדכן בהתאם לאורך החדש | |
| 13 | בדוק Resize | משוך ידית תחתונה — גובה ו-mode משתנים בהתאם למשך החדש | |
| 14 | בדוק בין משימות "זמן פנוי" | מוצג בצבע ירוק מקווקו, לחיצה פותחת יצירת משימה | |

---

### חלק ב: PlanMyDayButton ו-PlanningDraftPanel

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 15 | לחץ על "סדר לי את היום" | נפתח Preview עם רשימת משימות מסודרות | |
| 16 | בדוק שהשעה הראשונה בתוצאה > עכשיו | **אין שיבוץ בעבר** — No Past שמור | |
| 17 | בדוק warnings | הודעה על שיבוץ מהשעה הנוכחית בלבד | |
| 18 | לחץ "לא עכשיו" | הפאנל נסגר, **שום דבר לא נשמר ב-DB** | |
| 19 | צור anchor task (יציאה ל-X בשעה Y) + משימות הכנה | משימות הכנה מופיעות **לפני** ה-anchor | |
| 20 | בדוק schedulingContextReasons | הסברי שיבוץ מוצגים על כל משימה | |
| 21 | פתח HaMefraket, הזן קלט ראשון | תפריט draft נפתח | |
| 22 | הזן קלט נוסף | נוסף לרשימת drafts | |
| 23 | ערוך שם draft ידנית | העריכה נשמרת ב-store | |
| 24 | אם מוצגת "הצעת משך" (כתום) — לחץ "השתמש בהצעה" | ה-preview מחושב מחדש עם משך חדש | |
| 25 | ודא שלחיצה על "השתמש בהצעה" **לא שומרת ל-DB** | רק preview מתעדכן | |
| 26 | לחץ "אשר ושמור" | המשימות מופיעות ב-DayView | |
| 27 | רענן את הדף — המשימות עדיין קיימות | נשמרו ב-DB | |

---

### חלק ג: TaskDetail וביצוע

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 28 | לחץ על משימה ב-DayView | נפתח TaskDetail | |
| 29 | לחץ "התחל משימה" | טיימר רץ, `executionStartTimes` נשמר | |
| 30 | **רענן את הדף** | הטיימר ממשיך (זמן שמור ב-localStorage) | |
| 31 | לחץ "סיים משימה" | אחוז השלמה מוצג, משימה מסומנת כהושלמה | |
| 32 | בדוק שנוצר `task_execution_completed` עם `actualDurationMinutes` | ניתן לוודא דרך `/api/learning/daily-summary` | |
| 33 | נסה להתחיל אותה משימה פעמיים | לא נוצרים שני events, אין כפילות | |

---

### חלק ד: אמון AI ולמידה

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 34 | צור משימה חדשה ללא היסטוריה → שגר לPlanner | `learningBoost = 0`, אין "זזה בעבר" | |
| 35 | אחרי 3 השלמות של משימה דומה — שגר שוב | `durationSuggestion` מוצג | |
| 36 | בדוק ש-`durationMinutes` בschedule לא השתנה | suggestion הוא read-only בלבד | |
| 37 | צור learning events עם `source: "test"` → שגר | אין השפעה על `learningBoost` | |
| 38 | בדוק `/api/learning/planning-context` | `enabled: true`, `totalEvents >= 0` | |

---

### חלק ה: רגרסיה כללית

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 39 | `GET /api/health` | `{"status":"ok"}` | |
| 40 | `POST /api/planner/schedule` עם tasks | `ok:true`, `scheduledTasks` array | |
| 41 | `POST /api/planner/apply-schedule` עם tasks קיימות | `ok:true`, `updatedCount >= 1` | |
| 42 | `POST /api/planner/commit-draft-schedule` עם drafts תקינים | `ok:true`, `createdCount >= 1` | |
| 43 | `POST /api/learning/events` | event נשמר | |
| 44 | `GET /api/learning/daily-summary` | מחזיר summary | |
| 45 | syncTasksFromServer — רענן דף | tasks מסונכרנות, אין crashes | |
| 46 | localStorage migration — פתח דף לאחר ניקוי storage | Migration רצה, אין crashes | |

---

## הוראות הרצה

```bash
# בדיקות אוטומטיות (server חייב לרוץ על port 3001)
bash scripts/synco-trust-qa.sh

# בדיקות ידניות: ציין ✅ / ❌ / ⚠️ בעמודת "תוצאה"
```

## Adaptive Task Block — מצבי תצוגה

| משך משימה | mode | מה מוצג |
|-----------|------|----------|
| 1–5 דקות | **micro** | title בלבד (קצוץ) · text-[8px] |
| 6–15 דקות | **tiny** | שעת התחלה · title קצוץ · text-[9px] |
| 16–45 דקות | **compact** | title + HH:mm–HH:mm בשורה אחת |
| 46+ דקות | **full** | title בשורה + שעות מתחת + progress% אם פעיל |

> חישוב: `durationMinutes = Math.round(position.height / 80 * 60)`
> `position.height` = גובה raw לפני min-clamp של 20px

## קריטריוני מעבר

- **חובה לעבור**: #2–#13 (Adaptive Layout) + #39–#44 (Regression API)
- **חובה לעבור**: #16 No Past, #19 Anchor, #34 False Learning, #37 Source Filter
- **חובה לא להישבר**: DayView, Drag&Drop, Resize, PlanMyDayButton, Preview, אישור ושמירה, syncTasksFromServer
- **מותר לכשל**: אינטגרציות חיצוניות (Qdrant, Google Calendar) — לא קיימות

## מה **לא** נבדק ב-Sprint הזה (בכוונה)

- Auth ← לא קיים
- Google Calendar ← לא קיים
- Qdrant / AI ← לא קיים
- Dashboard ← לא קיים
- Mobile app ← Sprint נפרד
