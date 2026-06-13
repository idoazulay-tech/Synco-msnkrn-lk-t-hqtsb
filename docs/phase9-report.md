# Synco Phase 9 — Final Report
## Share / Persist / Wiki / Graph — Internal Product Foundation

---

## מה בוצע

Phase 9 הופך את Synco ממנוע תכנון טהור לבסיס מוצר שניתן להשתמש בו בפועל.
הוספנו שכבת persistence מלאה, endpoint חדש, ו-UI ראשוני.

---

## קבצים שנוצרו / שונו

### Prisma Schema
**`prisma/schema.prisma`** — 5 מודלים חדשים:
- `RawCaptureEvent` — אירוע גלם שנכנס מהמשתמש
- `BrainSignal` — אות מופק מהמנוע, מקושר ל-RawCaptureEvent
- `WikiEntry` — ערך ויקי אישי, upsert עם dedup נקודות מפתח
- `GraphNode` — צומת בגרף הידע, upsert עם חיזוק confidence
- `GraphEdge` — קשר בגרף, upsert עם מיזוג ראיות

### Localization
**`server/brain/localization/he.ts`** — נוסף בלוק `share`:
- הודעות הצלחה / dry-run / שגיאה חלקית
- פונקציות סיכום: `signalsSummary`, `wikiSummary`, `graphSummary`, `openQSummary`

### Services (חדשים)
| קובץ | תיאור |
|------|-------|
| `server/brain/services/rawEventStore.ts` | שמירה וסטטוס של RawCaptureEvent |
| `server/brain/services/signalStore.ts` | שמירת BrainSignals, כשלון חלקי מאובטח |
| `server/brain/services/personalWikiStore.ts` | Upsert WikiEntry עם dedup keyPoints |
| `server/brain/services/knowledgeGraphStore.ts` | Upsert Nodes + Edges עם confidence blending |
| `server/brain/services/persistFromRoutingPlan.ts` | Bridge: תוצאת pipeline → DB |

### Routes
**`server/routes/brain.ts`** — נוספו:
- `POST /api/brain/share` — קבלת טקסט, הרצת brain, persistence אופציונלי
- `GET /api/brain/share/status/:userId` — רשימת אירועים אחרונים

### Frontend
**`src/pages/BrainSharePage.tsx`** — דף DEV ב-`/brain-share`:
- Textarea לטקסט
- checkboxes: `persist` + `devMode`
- תוצאות: signals, open questions, wiki candidates, graph candidates, diagnostics

**`src/App.tsx`** — Route `/brain-share` → `BrainSharePage`

---

## מה כותב ל-DB (כשה-persist=true)

| טבלה | פעולה |
|------|-------|
| `RawCaptureEvent` | `create` אחד לכל קריאה |
| `BrainSignal` | `create` לכל signal שהמנוע הפיק |
| `WikiEntry` | `upsert` לפי `(userId, topic)` |
| `GraphNode` | `upsert` לפי `(userId, nodeType, label)` |
| `GraphEdge` | `upsert` לפי `(userId, fromNodeId, toNodeId, relationType)` |
| `OpenQuestion` | `create` דרך `persistDeferredQuestions` |

**לא נשמרים (planned_only):** episodic, behavioral, knowledge, preference, commitment memories — תכנון בלבד ב-Phase 9.

---

## פקודת Migration (ב-Replit בלבד)

```bash
npx prisma migrate dev --name add-continuous-brain-models
```

> ⚠️ אל תריץ locally. רק ב-Replit (hostname: helium).

---

## תוצאות בדיקות

```
=== Phase 9 Share/Persist Tests ===
66 passed, 0 failed
✅ All Phase 9 tests passed.
```

כולל:
- ✅ Pipeline טהור (ללא DB)
- ✅ commitment_signal + financial_signal
- ✅ שאלה פתוחה בעברית על שם לא מוכר
- ✅ מבנה Wiki candidates
- ✅ dedup keyPoints + sourceSignalIds
- ✅ Graph: person node + financial_issue node
- ✅ Input shape ל-persistFromRoutingPlan
- ✅ diagnostics `routedMemoryPersistence: planned_only`
- ✅ devMode on/off
- ✅ validation: userId + text
- ✅ Phase 4-8 modules importable
- ✅ Qdrant fallback intact
- ✅ brainPipeline unchanged
- ✅ Hebrew localization: share messages

---

## דוגמת Request / Response

**Request:**
```json
POST /api/brain/share
{
  "userId": "default-user",
  "text": "תחזור לדני מחר לגבי החזר כסף",
  "persist": true,
  "devMode": true
}
```

**Response (מקוצר):**
```json
{
  "ok": true,
  "message": "השיתוף הושלם. זיהיתי את ההקשר ושמרתי. זיהיתי 2 אותות. יש שאלה פתוחה אחת.",
  "signals": [
    { "signalType": "commitment_signal", "confidence": 0.75, "shouldCreateTask": true },
    { "signalType": "financial_signal",  "confidence": 0.70, "shouldUpdateWiki": true }
  ],
  "openQuestions": [
    { "questionType": "who_is_person", "questionText": "מי זה דני? מה הקשר שלך איתו?", "relatedEntityName": "דני" }
  ],
  "persisted": {
    "rawEvent": true,
    "signalsCount": 2,
    "wikiUpdatesCount": 1,
    "graphNodesCount": 2,
    "graphEdgesCount": 1,
    "openQuestionsCount": 1
  },
  "diagnostics": {
    "brain": ["commitment_signal(0.75)", "financial_signal(0.70)"],
    "persist": [
      "routedMemoryPersistence: planned_only (episodic/behavioral/knowledge/preference/commitment)",
      "signals: saved 2",
      "open_questions: saved 1",
      "wiki: 1 upserted (1 created, 0 updated)",
      "graph: 2n+ 0n~ / 1e+ 0e~"
    ]
  }
}
```

---

## סיכום סיכונים

| סיכון | טיפול |
|-------|-------|
| DB לא זמין | כל store מוגן ב-try-catch, מחזיר `{ ok: false, error }` |
| Qdrant לא זמין | try-catch fallback קיים, לא הוסר |
| persist=false | אפס כתיבות ל-DB |
| כשלון חלקי | `partialFailure=true` + כל השגיאות מדווחות |
| שמות conflicts | Types ב-`types/` ≠ Prisma models (שמות שונים) |

---

## Phase 10 — המשך מוצע

- חיבור `/brain-share` לתהליך onboarding
- שאלות פתוחות: UI לתשובה
- Wiki viewer: דף לצפייה בידע שנצבר
- Graph viewer: ויזואליזציה של הגרף האישי
- Trigger אוטומטי מ-quick-add flow

---

**Phase 9 הושלם בהצלחה.**
