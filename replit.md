# Task Timer App

## Overview
The Task Timer App is a Hebrew-language task management and timer application built with React. Its primary purpose is to help users manage daily tasks through time-based scheduling. Key capabilities include a circular progress timer, day/month calendar views, task completion tracking, and management of unscheduled standby tasks. The project aims to provide an ADHD-focused task management solution, simplifying interaction and promoting mental focus.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Build Tool**: Vite with SWC.
- **Routing**: React Router DOM.
- **State Management**: Zustand with local storage persistence.
- **Styling**: Tailwind CSS with CSS variables.
- **UI Components**: shadcn/ui built on Radix UI.
- **Animations**: Framer Motion.

### Data Model
Tasks progress through a lifecycle: pending → in_progress → completed/not_completed → archived. Key entities include `Task`, `StandbyTask`, `TaskTemplate`, `TemplateCategory`, `HistoryEntry`, and `Tag`.

### Key Features
- **Task Template System ("המתנה")**: Pre-configured task blueprints for quick scheduling, with usage tracking and categorization.
- **HaMekolel Smart Parser (המכולל)**: Natural language Hebrew text parser to convert freeform text into scheduled tasks, automatically detecting dates and times. It handles AM/PM ambiguity and supports various Hebrew time expressions.
- **Voice Input (קלט קולי)**: Utilizes Web Speech API for Hebrew speech recognition, integrating with HaMekolel for automatic date/time extraction and conflict detection.
- **Conflict Detection**: Automatically identifies and visually warns users about overlapping tasks during creation or scheduling.
- **Notification System**: In-app notification center with user-configurable settings, supporting various notification types (conflict, reminder, success, warning, info) with sound and vibration.
- **Mental Focus Feature (מיקוד מנטלי)**: Displays motivational action phrases during active tasks based on completion percentage zones to maintain focus and drive.
- **HaMefraket (המפרקט) - Smart ADHD Assistant**: An intelligent interface accessible via a split floating button for quick text or voice input, providing detected intent, insights, and self-regulation exercises.

### Backend Architecture
- **Server**: Express.js with TypeScript.
- **Database**: PostgreSQL via Prisma 7.
- **Concurrency**: Frontend and backend run together using `concurrently`.
- **API Proxy**: Vite proxies `/api/*` requests to the backend.

### 7-Layer AI Architecture (server/layers/)
A modular architecture for intelligent task management:
1.  **Input Layer**: Normalizes text and cleans filler words.
2.  **Intent Engine**: A 10-step pipeline for detecting language, classifying input type, identifying primary intents, extracting entities (time, date, duration, etc.), detecting commitment and cognitive load, identifying missing information, computing confidence, and providing explainability. Supports Hebrew number words and various intents like `create_task`, `reschedule`, `journal_entry`, etc.
3.  **Decision Engine**: A modular, strategy-based architecture deciding whether to `execute`, `ask`, `reflect`, or `stop` based on confidence thresholds and policies (e.g., one question per turn).
4.  **Task Engine**: Handles task decomposition and time estimation.
5.  **Learning Engine**: Records patterns and updates personal time statistics.
6.  **Automation Layer**: Placeholder for calendar sync and triggers.
7.  **Feedback Layer**: Placeholder for day reviews.

**Constraint Types Supported**: deadline, allowed_window, forbidden_window, energy_profile, reduced_load_day.

### Rule Engine / Voice-to-Task Engine
Determines input as `task_or_event` or `journal_entry`. Extracts details for tasks (title, dates, times, location, etc.) and journals (mood, intensity, tags). Features smart title generation, phone call location inference, and identifies actionable tasks from journal entries.

### Database Models
`TaskFile`, `TaskRun`, `RunStep`, `InsightLog`, `UserSettings`, `RegulationLog`.

### Regulation Exercises (ויסות)
Offers breathing exercises, grounding techniques, and quick physical exercises, with completion logged to the database.

### Design Decisions
1.  **Full-Stack Architecture**: Express backend with PostgreSQL.
2.  **RTL Support**: Hebrew language and right-to-left text direction.
3.  **Mobile-First**: Bottom navigation, touch-friendly UI.
4.  **Timer-Centric**: Core focus on the task timer.
5.  **ADHD-Focused**: Simplifies interaction for users with ADHD.

## External Dependencies

### UI Framework
- **Radix UI**: Accessible component primitives.
- **shadcn/ui**: Pre-styled components.
- **Lucide React**: Icon library.

### Date/Time
- **date-fns**: Date manipulation and formatting with Hebrew locale.

### Forms and Validation
- **React Hook Form**: Form state management.
- **@hookform/resolvers**: Validation resolver integration.
- **Zod**: Schema validation.

### Visualization
- **Recharts**: Charts for statistics.
- **Embla Carousel**: Carousel/slider functionality.

### Other
- **cmdk**: Command palette.
- **Vaul**: Drawer component.
- **next-themes**: Theme switching.
- **sonner**: Toast notifications.
- **Heebo Font**: Hebrew-optimized font.