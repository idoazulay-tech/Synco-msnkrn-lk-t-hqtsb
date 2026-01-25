# Task Timer App

## Overview
The Task Timer App is a Hebrew-language task management and timer application built with React, designed to help users manage daily tasks through time-based scheduling. It focuses on providing an ADHD-friendly solution by simplifying interaction and promoting mental focus. Key features include a circular progress timer, calendar views, task completion tracking, and management of unscheduled standby tasks.

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