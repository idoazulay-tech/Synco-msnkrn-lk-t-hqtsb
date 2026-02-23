# Synco (סינקו) - Task Timer App
**סלוגן:** "מסנכרן לך את הקצב"

---

## Development Methodology (מתודולוגיית פיתוח)

### Protocol: Before Implementing Any Feature

**שלב 1: סיווג ההנחיה**
| סוג | הגדרה | דוגמאות |
|-----|-------|---------|
| A | חוק-על מערכת (System Law/Gate) | "אסור לשבץ משימות בשבת" |
| B | לוגיקה פנימית של שכבה קיימת | שיפור parser קיים |
| C | פיצ'ר חדש | הוספת תמיכה בסוג משימה חדש |
| D | הרחבה/חיזוק פיצ'ר קיים | הוספת כפתור הקלטה לדף |

**שלב 2: היררכיית שכבות Synco (עדיפות יורדת)**
```
1. Core / Laws / Gates (חוקי-על) ← תמיד גוברים
   └── server/layers/decision/policies/
   
2. NLP & Time Understanding (הבנת שפה וזמן)
   └── server/layers/temporal/
   └── server/layers/intent/
   └── server/services/ruleEngine.ts
   
3. Task Classification (סיווג משימות)
   └── server/layers/task/rules/taskTypeClassifier.ts
   └── server/layers/intent/rules/patterns.ts
   
4. Scheduler & Optimization (שיבוץ והזזה)
   └── server/layers/task/planners/
   └── server/layers/task/TaskTimeEngine.ts
   
5. UI & Integrations (ממשק וחיבורים)
   └── src/pages/
   └── src/components/
   └── server/layers/automation/
```

**שלב 3: שמירת יכולות קיימות (חובה)**
- אסור לשבור/לעקוף/להחליש פיצ'רים קיימים
- אם נדרש קוד חדש לשמירת התנהגות - הוסף
- אם מסדרים קבצים - עדכן imports, בדוק רגרסיות
- אל תמחק קוד בלי תחליף עובד

**שלב 4: בדיקת סתירות**
- חוק-על תמיד קודם
- אם יש ספק → needs_clarification

**שלב 5: דיווח סיום**
- שכבה שהושפעה
- קבצים שהשתנו
- מה נוסף/שונה
- אישור: "לא נפגעו יכולות קיימות"

---

## Overview
Synco is a Hebrew-language task management and timer application built with React, designed to help users manage daily tasks through time-based scheduling. It focuses on providing an ADHD-friendly solution by simplifying interaction and promoting mental focus. Key features include a circular progress timer, calendar views, task completion tracking, and management of unscheduled standby tasks.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
- **ADHD-Focused**: Simplifies interaction and promotes mental focus.
- **RTL Support**: Full support for Hebrew language and right-to-left text direction.
- **Mobile-First**: Designed for touch-friendly interfaces with bottom navigation.
- **Timer-Centric**: The core experience revolves around the task timer.
- **Full-Stack Architecture**: Utilizes an Express backend with a PostgreSQL database.

### Frontend
- **Framework**: React 18 with TypeScript, built using Vite.
- **State Management**: Zustand for state, persisted in local storage.
- **Styling**: Tailwind CSS with shadcn/ui for components, built on Radix UI.
- **UI/UX**: Features a circular progress timer, day/month calendar views, task completion tracking, and a task template system ("המתנה").
- **Key Features**:
    - **HaMekolel Smart Parser (המכולל)**: Natural language Hebrew text parser for scheduling tasks. Supports time ranges like "מ12 עד 15" or "בין 10 ל-12".
    - **Voice Input (קלט קולי)**: Web Speech API for Hebrew speech recognition, integrated with HaMekolel.
    - **Conflict Detection**: Visual warnings for overlapping tasks.
    - **Notification System**: In-app notifications with user-configurable settings.
    - **Mental Focus Feature (מיקוד מנטלי)**: Motivational phrases during tasks based on completion.
    - **HaMefraket (המפרקט) - Smart ADHD Assistant**: Intelligent interface for quick input, insights, and self-regulation exercises.
    - **MA Auto-Task Creation**: When MA is confident about task details, tasks are automatically created and added to the calendar without manual confirmation.
    - **Clarifying Questions Loop**: When MA needs more information (uncertain about time, date, etc.), questions appear in the ארגון (Organization) page. User answers are re-analyzed by MA until task can be created with complete details.
    - **Relative Scheduling (Anchor Scheduling)**: Schedule tasks relative to timeline using Hebrew phrases like "אחרי המשימה הנוכחית", "מתחילת המשימה הבאה", "אחרי המשימה הבאה". MA resolves anchor times from current/next tasks automatically.
    - **Contextual Time Disambiguation**: Smart parsing of ambiguous time inputs (e.g., "12") based on linguistic context (בוקר/צהריים/ערב/לילה) and future-biased temporal proximity.
    - **TIME_SPOKEN_HE_IL_TO_DIGITAL**: Modular parser for spoken Hebrew time (e.g., "שמונה חמישים ותשע" → 8:59). Supports round hours ("שמונה בדיוק", "שמונה עגול"), all minute values 00-59, and validates output.

### Temporal Engine (ma_temporal_engine_he_v1)
A comprehensive Hebrew temporal expression parser integrated into MA's Intent Engine. Located at `server/layers/temporal/`.

**Capabilities:**
- **Spoken times**: "שמונה חמישים ותשע" → 08:59
- **Quarter/Half expressions**: "עשר ורבע" → 10:15, "רבע לשמונה" → 07:45, "שלוש חסר רבע" → 02:45
- **Day parts**: "8 בערב" → 20:00, "8 בבוקר" → 08:00
- **Relative dates**: "מחר", "מחרתיים", "בעוד שבוע", "יום שני הבא"
- **Durations**: "שעתיים", "חצי שעה", "45 דקות"
- **Time intervals**: "מ-10 עד 12", "בין 8 ל-10"
- **Recurrence patterns**: "כל יום שני", "פעמיים בשבוע"
- **Ambiguous expressions**: "בערך", "לקראת", "סוף היום" → Returns hints instead of guessing

**Output Types:** TimePoint, DatePoint, Duration, Interval, Recurrence, AmbiguousTime

**API Endpoints:** `/api/temporal/parse`, `/api/temporal/suggest`, `/api/temporal/demo`

**Integration:** Automatically used by `extractEntities` in the Intent Engine, with fallback to legacy parsers when confidence is low.

### Backend and AI Architecture
The backend is built with Express.js and TypeScript, using PostgreSQL via Prisma. It incorporates a 7-Layer AI architecture for intelligent task management:
1.  **Input Layer**: Text normalization.
2.  **Intent Engine**: Detects language, classifies input, identifies intents (e.g., `create_task`, `reschedule`), extracts entities, and computes confidence.
3.  **Decision Engine**: Determines whether to `execute`, `ask`, `reflect`, or `stop` based on confidence and policies.
4.  **Task & Time Engine**: Manages task lifecycle (pending → in_progress → completed/not_completed → archived), scheduling, and conflict resolution. Supports various action types and constraints (e.g., deadline, allowed_window).
5.  **Learning Engine**: Collects decision data, detects user patterns, proposes preference rules, and updates confidence models.
6.  **Automation Layer**: Plans and executes external actions with job queuing, retry policies, and audit logging.
7.  **Feedback & Review Layer**: Generates reflections, post-action feedback, daily reviews, and micro-step suggestions. Includes a check-in system and dynamic tone based on stress levels.

### Mobile App (React Native + Expo)
A full-featured companion app providing complete access to all MA features:

**Screens (4 tabs)**:
- **Input (קלט)**: Text/voice input, full analysis results (intent, entities, confidence), feedback feed
- **Shikul (שיקלול)**: Check-ins, plan choices (A/B), high-priority feedback items
- **Review (סיכום)**: Daily stats, request review button, blocker/must/micro-step cards
- **Settings (הגדרות)**: Server URL configuration, connection test

**API Integration**: Full access to /api/analyze, /api/answer, /api/action, /api/state, /api/feedback, /api/feedback/checkin/respond, /api/feedback/daily-review/request

**Running**: `cd mobile && npm install && npm start`, then scan QR with Expo Go

**Limitations (MVP)**: Voice input is UI placeholder (STT needs native module), works only when app open

## External Dependencies

### UI/UX Libraries
-   **Radix UI**: Accessible component primitives.
-   **shadcn/ui**: Pre-styled UI components.
-   **Lucide React**: Icon library.
-   **Heebo Font**: Hebrew-optimized font.

### Data & Time Management
-   **date-fns**: Date manipulation and formatting with Hebrew locale support.

### Forms & Validation
-   **React Hook Form**: Form state management.
-   **Zod**: Schema validation.

### Data Visualization & Animation
-   **Recharts**: Charting library for statistics.
-   **Framer Motion**: Animation library.

### Utilities
-   **cmdk**: Command palette.
-   **Vaul**: Drawer component.
-   **next-themes**: Theme switching.
-   **sonner**: Toast notifications.

### Synco Brain v1 (AI Learning System)
Located at `server/brain/`. An AI-powered learning system with long-term memory and adaptive behavior.

**Architecture (3 Zones):**
- **Active Brain (Replit)**: Real-time processing pipeline
- **Long-term Memory (Qdrant)**: 4 vector collections (user_events, user_insights, user_profile, synco_knowledge), 1536-dim Cosine
- **Knowledge Library**: Domain-specific ADHD/time-management knowledge

**6 Services Pipeline:**
1. **Ingestion** (`services/ingestion.ts`): Normalizes Hebrew text, extracts metadata, creates embedding text
2. **Memory** (`services/memory.ts`): `storeUserMessage(userId, text, meta)` saves to user_events with userId/text/timestamp/type/isFallbackEmbedding. `searchUserMemory(userId, queryText, limit)` retrieves with MUST userId filter. Also: `buildContext()`, `storeLearningState()`, `storeInsight()`
3. **Understanding** (`services/understanding.ts`): OpenAI analysis with Hebrew system prompt, validates JSON output
4. **Policy Gate** (`services/policy.ts`): Trust progression (learning → cautious → trusted), persisted in Qdrant
5. **Curiosity** (`services/curiosity.ts`): Schedules proactive questions, deduplication, priority queue
6. **Orchestrator** (`index.ts`): Coordinates full pipeline, caps confidence when using fallback embeddings

**API Endpoints:** `/api/brain/process`, `/api/brain/approve`, `/api/brain/curiosity/answer`, `/api/brain/status/:userId`

**OpenAI Integration:** Uses Replit AI Integrations (gpt-4.1-mini for chat). Embeddings API not supported - uses hash-based fallback with capped confidence.

**Qdrant Integration:** 4 collections with payload indices. Learning state persisted via deterministic UUIDs (v5).

**Qdrant Infrastructure (Single Source of Truth):**
- Client: `server/lib/qdrant.ts` — exports `qdrant`, `testQdrantConnection()`, `ensureCollections()`, `upsertPoint()`, `searchSimilar()`
- Init: `server/lib/qdrant-init.ts` — exports `initQdrantCollections()`, creates 4 collections + payload indices on startup
- User isolation: All personal collections filter by `userId` (MUST filter). `synco_knowledge` is shared.
- Debug endpoint: `POST /api/memory/debug/search` (dev only) — validates userId, returns filtered results
- Guard: `validateUserId()` exported from `server/routes/memory-debug.ts` for reuse