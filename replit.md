# Task Timer App

## Overview

A Hebrew-language task management and timer application built with React. The app helps users manage daily tasks with time-based scheduling, featuring a circular progress timer, day/month calendar views, and task completion tracking. Users can create tasks with specific time slots, view them in different calendar formats, track completion rates, and manage standby tasks that haven't been scheduled yet.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC for fast compilation
- **Routing**: React Router DOM for client-side navigation
- **State Management**: Zustand with persist middleware for local storage persistence
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for smooth transitions and micro-interactions
- **Data Fetching**: TanStack React Query (configured but not heavily utilized yet)

### Component Structure
- `src/components/ui/` - Reusable shadcn/ui components (buttons, dialogs, forms, etc.)
- `src/components/layout/` - App layout components (AppLayout, BottomNav, FloatingTimer)
- `src/components/timer/` - Timer-specific components (CircularProgress, CompletionDialog)
- `src/components/task/` - Task display components (TaskCard)
- `src/pages/` - Route-level page components

### State Management Pattern
- **Zustand Store** (`src/store/taskStore.ts`): Centralized state for tasks, standby tasks, archived tasks, and tags
- **Persistence**: Uses Zustand persist middleware to save state to localStorage
- **Custom Hooks**: `useTaskTimer` hook for real-time timer calculations and dialog triggers

### Data Model
Tasks have a lifecycle: pending → in_progress → completed/not_completed → archived. Key entities:
- `Task`: Main task object with title, times, tags, location, history
- `StandbyTask`: Unscheduled tasks waiting to be assigned times
- `TaskTemplate`: Reusable task blueprints for quick scheduling (with usageCount, lastUsedAt tracking)
- `TemplateCategory`: Grouping for templates with colors
- `HistoryEntry`: Audit trail for task modifications
- `Tag`: Categorization with colors

### Task Template System ("המתנה")
- Templates are pre-configured task blueprints with title, duration, category, and tags
- Quick scheduling converts a template to a calendar task with a chosen date/time
- Usage tracking: templates sorted by recent use (last 24h), then by frequency
- Categories organize templates with color-coded labels
- Date fields are properly rehydrated from localStorage via onRehydrateStorage callback

### HaMekolel Smart Parser (המכולל)
- Natural language Hebrew text parser that converts freeform text into scheduled tasks
- Automatically detects dates and times from Hebrew expressions
- Supported expressions:
  - מחר (tomorrow), מחרתיים (day after tomorrow), היום (today)
  - יום X הקרוב/הבא (next day X, e.g., "יום רביעי הקרוב")
  - יום X בשבוע הבא (day X next week)
  - תאריך X (specific date, e.g., "תאריך 15/01")
  - Time expressions: בשעה X, ב-X, numeric times
  - Hebrew time fractions: ורבע (+15 min), וחצי (+30 min), רבע ל (-15 min), חמישה ל (-5 min), עשרה ל (-10 min), עשרים ל (-20 min)
  - צהריים/צהרים/צוהוריים/צוהורים variations to indicate PM times
  - בזמן הפנוי הבא (next free time slot)
  - בזמן הפנוי ביום הבא (next free time tomorrow)
  - אחרי המשימה האחרונה היום (after last task today)
  - באותה שעה בעוד X ימים/שבועות/חודשים (same time in X days/weeks/months)
- AM/PM ambiguity handling: When context is unclear for hours 1-12, displays two time options for user selection
- Component: `src/components/task/HaMekolel.tsx`
- Parser utility: `src/lib/hebrewDateParser.ts`
- Uses `ensureDate()` helper to handle persisted tasks stored as strings in localStorage

### Voice Input (קלט קולי)
- Uses Web Speech API with Hebrew locale (he-IL) for speech recognition
- Integrates with HaMekolel parser for automatic date/time extraction
- Displays real-time transcription during recording
- Shows parsed results with date/time badges before confirmation
- Conflict detection on voice-created tasks
- Component: `src/components/voice/VoiceInput.tsx`

### Conflict Detection
- Automatically identifies overlapping tasks when creating new ones
- Visual warnings displayed in task creation form
- Notifies users through in-app notification system
- Works across calendar and voice input modes

### Notification System
- In-app notification center with popover UI
- Notification types: conflict, reminder, success, warning, info
- User-configurable settings for notification types and methods
- Sound and vibration support (when device supports)
- Unread count badge in bottom navigation
- Persistent storage with localStorage
- Components: `src/components/notifications/NotificationCenter.tsx`, `src/components/settings/NotificationSettings.tsx`
- Store: `src/store/notificationStore.ts`

### Mental Focus Feature (מיקוד מנטלי)
- Displays motivational action phrases during active tasks based on completion percentage
- Five percentage zones with different phrase pools:
  - Zone 1 (0-10%): Starting correctly - action initiation
  - Zone 2 (10-20%): Creating sequence - maintaining momentum
  - Zone 3 (20-60%): Effective execution - peak performance
  - Zone 4 (60-90%): Smart closing - preventing perfectionism
  - Zone 5 (90-100%): Satisfying finish - clean closure
- Phrases are randomly selected per zone; zones only progress forward (never backwards)
- Component: `src/components/focus/FocusMessageOverlay.tsx`
- Messages data: `src/lib/focusMessages.ts`

### HaMefraket (המפרקט) - Smart ADHD Assistant
- Intelligent "brain and hand" wrapper that simplifies task management for ADHD users
- Accessible via split floating button above bottom navigation:
  - Blue button (keyboard icon): Opens text input mode
  - Orange button (microphone icon): Opens voice input mode
- Components:
  - `src/components/mefraket/MefraketButton.tsx` - Split floating action button
  - `src/components/mefraket/QuickInputPanel.tsx` - Text/voice input panel
  - `src/components/mefraket/UnderstandingScreen.tsx` - Shows detected intent and actions
  - `src/components/mefraket/InsightsDrawer.tsx` - Detailed insights and detected data
  - `src/components/mefraket/RegulationModal.tsx` - Self-regulation exercises

### Backend Architecture (NEW)
- **Server**: Express.js running on port 3001 with TypeScript
- **Database**: PostgreSQL via Prisma 7 with PrismaPg adapter
- **Concurrency**: Frontend (Vite on 5000) and backend run together via `concurrently`
- **Proxy**: Vite proxies `/api/*` requests to backend on port 3001

### 7-Layer AI Architecture (server/layers/)
Modular architecture for intelligent task management:

1. **Input Layer** (`/input`): Normalizes text, cleans filler words (אממ, אהה, כאילו, etc.)
2. **Intent Engine** (`/intent`): MODULAR 10-STEP PIPELINE
   - **Pipeline Architecture**:
     - Step 1: normalizeText - Clean filler words, normalize whitespace
     - Step 2: detectLanguage - Identify Hebrew/English/mixed
     - Step 3: classifyInputType - command/thought/question/correction/emotional_dump
     - Step 4: detectIntents - Primary intent detection
     - Step 5: extractEntities - Time, date, duration, people, location, taskName, urgency, constraints
     - Step 6: detectCommitment - high/medium/low commitment level
     - Step 7: detectCognitiveLoad - low/medium/high cognitive load
     - Step 8: detectMissingInfo - What info is needed to proceed
     - Step 9: computeConfidence - Weighted confidence scoring
     - Step 10: explainability - Internal reasoning notes
   - **Directory Structure**:
     - `pipeline/` - 10 pipeline step modules
     - `rules/` - Keywords, patterns, scoring weights
     - `memory/` - ContextManager for session state and follow-up detection
     - `types/` - TypeScript interfaces for intents, entities, context
     - `__tests__/` - 19 unit tests (all passing)
   - **Entity Extraction**: Hebrew number words support (בשלוש → 15:00)
   - **Intents**: create_task, create_event, reschedule, inquire, cancel, decompose_task, journal_entry, set_constraint, manage_day
   - **2-6 word title enforcement**
3. **Decision Engine** (`/decision`): Decides execute/ask/reflect/stop
   - Strict time/date requirement for scheduling intents
   - Emotional dump triggers reflect mode
4. **Task Engine** (`/task`): Task decomposition, time estimation with personal stats
   - Quantity modifiers: קצת=0.5x, הרבה=2x
   - Generic decomposition: prep → do → cleanup
   - Food/cleaning-specific decomposition patterns
5. **Learning Engine** (`/learning`): Records patterns, updates personal time stats
6. **Automation Layer** (`/automation`): Placeholder for calendar sync, triggers
7. **Feedback Layer** (`/feedback`): Placeholder for day reviews

**Constraint Types Supported:**
- deadline: חייב עד, לא יאוחר מ
- allowed_window: רק ב, רק אחרי
- forbidden_window: אל תשים, אחרי X לא
- energy_profile: בבוקר אני חד, בערב אין לי כוח
- reduced_load_day: אין לי קיבולת, אני קורס

**API Endpoints:**
- POST `/api/layers/process` - Process input through all layers
- POST `/api/layers/learn/completion` - Record task completion for learning
- GET `/api/layers/stats/personal` - Get personal time stats
- GET `/api/layers/insights` - Get learning insights

### Rule Engine / Voice-to-Task Engine (server/services/ruleEngine.ts)
- Dual-mode detection: `task_or_event` vs `journal_entry`
- Mode determination uses: action verbs, time/date signals, reminder triggers, commitment words
- Task mode extracts: title, dates, times, location, participants, type, priority, flexibility
- Journal mode extracts: mood (8 types), intensity (1-5), tags, action suggestions
- **Smart Title Generation**:
  - Spoken sentence NEVER becomes the title (2-6 word limit enforced)
  - Narrative to action conversion: "דיברתי עם X וקבענו פגישה" → "פגישה עם X"
  - Already scheduled detection: uses verb form ("לקבוע פגישה") vs noun form ("פגישה")
  - Final validation strips all remaining time/date/location patterns
- **Phone Call Location Inference**: If participant + speech verb + no physical location → "שיחת טלפון"
- Supported phrase categories:
  - TIME_SIGNALS: בשעה, בבוקר, בצהריים, בערב, etc.
  - DATE_SIGNALS: היום, מחר, מחרתיים, השבוע, חודש הבא, etc.
  - ACTION_VERBS: לקנות, להתקשר, לשלוח, לסיים, etc. (20+ verbs)
  - SPEECH_VERBS: דיברתי, נדבר, שיחה, לטלפון, התקשרתי, להתקשר, שוחחתי, התייעצתי
  - NARRATIVE_VERBS: דיברתי, אמרתי, סיפרתי, הסברתי, שאלתי, התקשרתי, נפגשתי, הלכתי, הייתי
  - Emotional phrases: stuck, mental load, procrastination, obligation, chaos, money, people conflict
- suggested_tasks_from_journal: Extracts up to 3 actionable tasks from journal entries
- Learning log structure for iterative improvement
- Clarification policy: Only for meetings/appointments without date/time

### Database Models (prisma/schema.prisma)
- TaskFile: Persistent task templates with title, description, tags, urgency
- TaskRun: Active task instances with status tracking
- RunStep: Individual steps within a task run
- InsightLog: Logs of parsed user inputs and detected patterns
- UserSettings: User preferences (JSON)
- RegulationLog: Self-regulation exercise completions

### Regulation Exercises (ויסות)
- Breathing exercises (4-7-8, box breathing)
- Grounding techniques (5-4-3-2-1)
- Quick physical exercises (stretching)
- Exercises available via `/api/regulation/exercises/:type/random`
- Completion logged to database

### Design Decisions
1. **Full-Stack Architecture**: Express backend with PostgreSQL for persistence
2. **RTL Support**: Hebrew language with right-to-left text direction considerations
3. **Mobile-First**: Bottom navigation pattern, touch-friendly UI elements
4. **Timer-Centric**: Core feature is the task timer with percentage and remaining time display
5. **ADHD-Focused**: HaMefraket simplifies interaction with voice/text quick input

## External Dependencies

### UI Framework
- **Radix UI**: Accessible component primitives (dialog, dropdown, popover, tabs, etc.)
- **shadcn/ui**: Pre-styled components using Radix primitives
- **Lucide React**: Icon library

### Date/Time
- **date-fns**: Date manipulation and formatting with Hebrew locale support

### Forms and Validation
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Validation resolver integration
- **Zod**: Schema validation (via resolvers)

### Visualization
- **Recharts**: Charts for statistics page
- **Embla Carousel**: Carousel/slider functionality

### Other
- **cmdk**: Command palette component
- **Vaul**: Drawer component
- **next-themes**: Theme switching support
- **sonner**: Toast notifications
- **Heebo Font**: Hebrew-optimized Google Font