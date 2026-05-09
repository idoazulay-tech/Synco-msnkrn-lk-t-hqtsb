# רשימת בדיקות ידנית — Synco Trust QA
## Sprint Pack 3ה — Trust + QA Pack

> בצע כל שלב לפי הסדר. סמן ✅ / ❌ / ⚠️ ליד כל פריט.

---

### חלק א: DayView ותצוגת משימות

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 1 | פתח `/day` | הדף נטען בלי שגיאות, מוצגת ציר הזמן | |
| 2 | צור משימה קצרה (15 דק') בשעה שעברה היום | **המשימה לא תשובץ בעתיד אם היא fixed** | |
| 3 | צור 3 משימות גמישות ללא שעה | כולן משובצות **לא לפני הרגע הנוכחי + 5 דקות** | |
| 4 | ודא שאין משימה שמופיעה בשעה שכבר עברה (אם היא flexible) | לא צריכה להופיע בעבר | |
| 5 | בדוק שמשימה של 10 דקות מציגה שורה אחת: שם + שעת התחלה–סיום | תצוגה קריאה, לא נחתכת | |
| 6 | בדוק שמשימה של 60 דקות מציגה שם + שעות בשתי שורות | תצוגת full | |
| 7 | בדוק שבין משימות יש "זמן פנוי · X דק'" | מוצג בצבע ירוק מקווקו | |
| 8 | לחץ על "זמן פנוי" | נפתח דיאלוג יצירת משימה בזמן הפנוי | |
| 9 | בדוק Drag & Drop: גרור משימה לשעה אחרת | המשימה זזה, זמנים מתעדכנים | |
| 10 | בדוק Resize: משוך ידית תחתונה למשימה | משך המשימה משתנה | |

---

### חלק ב: PlanMyDayButton ו-PlanningDraftPanel

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 11 | לחץ על "סדר לי את היום" | נפתח Preview עם רשימת משימות מסודרות | |
| 12 | בדוק שהשעה הראשונה בתוצאה > עכשיו | אין שיבוץ בעבר | |
| 13 | בדוק warnings בתוצאה — צריכה להיות הודעה על שיבוץ מהשעה הנוכחית | `"שיבוץ מהשעה הנוכחית בלבד"` | |
| 14 | לחץ "לא עכשיו" | הפאנל נסגר, **שום דבר לא נשמר ב-DB** | |
| 15 | צור משימה עם anchor (למשל: "יציאה ל-X בשעה Y") + משימות הכנה | משימות הכנה מופיעות **לפני** הanchor | |
| 16 | בדוק schedulingContextReasons בתצוגת preview | הסברי שיבוץ מוצגים | |
| 17 | פתח HaMefraket, הזן קלט ראשון | תפריט draft נפתח | |
| 18 | הזן קלט נוסף | נוסף לרשימת drafts | |
| 19 | ערוך שם draft ידנית | העריכה נשמרת ב-store | |
| 20 | אם מוצג "הצעת משך" (כתום) — לחץ "השתמש בהצעה" | ה-preview מחושב מחדש עם משך חדש | |
| 21 | ודא שלחיצה על "השתמש בהצעה" **לא שומרת ל-DB** | רק preview מתעדכן | |
| 22 | לחץ "אשר ושמור" | המשימות מופיעות ב-DayView | |
| 23 | רענן את הדף — המשימות עדיין קיימות | נשמרו ב-DB | |

---

### חלק ג: TaskDetail וביצוע

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 24 | לחץ על משימה ב-DayView | נפתח TaskDetail | |
| 25 | לחץ "התחל משימה" | טיימר רץ, `executionStartTimes` נשמר | |
| 26 | **רענן את הדף** | הטיימר ממשיך (זמן שמור ב-localStorage) | |
| 27 | לחץ "סיים משימה" | מופיע אחוז השלמה, משימה מסומנת כהושלמה | |
| 28 | בדוק שנוצר event `task_execution_completed` עם `actualDurationMinutes` | ניתן לוודא דרך `/api/learning/daily-summary` | |
| 29 | נסה להתחיל את אותה משימה פעמיים (אם ממשק מאפשר) | לא נוצרים שני events, לא כפילות | |

---

### חלק ד: אמון AI ולמידה

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 30 | צור משימה חדשה ללא היסטוריה → שדר לPlanner | `learningBoost = 0`, אין "זזה בעבר" | |
| 31 | אחרי 3 השלמות של משימה דומה — שדר שוב | מופיעה `durationSuggestion` | |
| 32 | בדוק שה-`durationMinutes` בschedule לא השתנה (רק ההצעה מוצגת) | suggestion הוא read-only | |
| 33 | צור learning events עם `source: "test"` → שדר | אין השפעה על learningBoost | |
| 34 | בדוק `/api/learning/planning-context` | מחזיר `enabled: true`, `totalEvents >= 0` | |

---

### חלק ה: רגרסיה כללית

| # | פעולה | ציפייה | תוצאה |
|---|-------|---------|--------|
| 35 | `GET /api/health` | `{"ok":true}` | |
| 36 | `POST /api/planner/schedule` עם tasks | `ok:true`, `scheduledTasks` array | |
| 37 | `POST /api/planner/apply-schedule` עם tasks קיימות | `ok:true`, `updatedCount >= 1` | |
| 38 | `POST /api/planner/commit-draft-schedule` עם drafts תקינים | `ok:true`, `createdCount >= 1` | |
| 39 | `POST /api/learning/events` | event נשמר | |
| 40 | `GET /api/learning/daily-summary` | מחזיר summary | |
| 41 | syncTasksFromServer — רענן דף, בדוק שמשימות נטענות | tasks מסונכרנות | |
| 42 | localStorage migration — פתח דף ראשון לאחר ניקוי storage | Migration רצה, אין crashes | |

---

## הוראות הרצה

```bash
# בדיקות אוטומטיות (server ב-port 3001)
bash scripts/synco-trust-qa.sh

# בדיקות ידניות: ציין ✅ / ❌ / ⚠️ ב-תוצאה לכל שורה
```

## קריטריוני מעבר

- **חובה לעבור**: 1–15 (No Past, Anchor, False Learning, Source Filter, Real Boost, Duration Suggestion, Draft No DB, Commit, Rollback, Apply Safety, Execution, LocalTime)
- **חובה לא להישבר**: DayView, Drag&Drop, PlanMyDayButton, Preview, אישור ושמירה, syncTasksFromServer
- **מותר לכשל**: אינטגרציות חיצוניות (Qdrant, Google Calendar) — לא קיימות

## מה **לא** נבדק ב-Sprint הזה (בכוונה)

- Auth ← לא קיים
- Google Calendar ← לא קיים  
- Qdrant / AI ← לא קיים
- Dashboard ← לא קיים
- Mobile app ← Sprint נפרד
