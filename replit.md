# Synco (סינקו) - Task Timer App
**Slogan:** "מסנכרן לך את הקצב" (Synchronizing your rhythm)

## Overview
Synco is a Hebrew-language task management and timer application designed to help users manage daily tasks through time-based scheduling. It aims to provide an ADHD-friendly solution by simplifying interaction, promoting mental focus, and offering intelligent assistance. Key capabilities include a circular progress timer, calendar views, task completion tracking, management of unscheduled standby tasks, and advanced natural language processing for task input. The project's ambition is to create a comprehensive, AI-powered personal assistant for time management, deeply integrated with user behavior and preferences.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
-   **ADHD-Focused**: Simplifies interaction and promotes mental focus.
-   **RTL Support**: Full support for Hebrew language and right-to-left text direction.
-   **Mobile-First**: Designed for touch-friendly interfaces with bottom navigation.
-   **Timer-Centric**: The core experience revolves around the task timer.
-   **Full-Stack Architecture**: Utilizes an Express backend with a PostgreSQL database.

### Frontend
-   **Framework**: React 18 with TypeScript, built using Vite.
-   **State Management**: Zustand for state, persisted in local storage.
-   **Styling**: Tailwind CSS with shadcn/ui components, built on Radix UI.
-   **UI/UX**: Features a circular progress timer, day/month calendar views, task completion tracking, and a task template system.
-   **Key Features**:
    -   **HaMekolel Smart Parser**: Natural language Hebrew text parser for scheduling tasks, supporting complex time ranges.
    -   **Voice Input**: Web Speech API for Hebrew speech recognition.
    -   **Conflict Detection**: Visual warnings for overlapping tasks.
    -   **Notification System**: In-app notifications.
    -   **Recurring Tasks**: Frontend-only engine for daily/weekly/monthly/yearly recurring tasks with various constraints.
    -   **Full Task Edit Page**: Comprehensive editing for all task attributes.
    -   **All-Day Tasks**: Specific handling and display for all-day events.
    -   **Task Cabinet Auto-Seed**: Pre-populated task categories and templates for quick setup.
    -   **Mental Focus Feature**: Motivational phrases during tasks.
    -   **HaMefraket (Smart ADHD Assistant)**: Intelligent interface for quick input, insights, and self-regulation exercises.
    -   **Automated Task Creation**: Tasks are automatically created when the AI is confident about details.
    -   **Clarifying Questions Loop**: AI asks for more information when uncertain.
    -   **Relative Scheduling**: Schedule tasks relative to existing timeline events using Hebrew phrases.
    -   **Contextual Time Disambiguation**: Smart parsing of ambiguous time inputs based on context.
    -   **TIME_SPOKEN_HE_IL_TO_DIGITAL**: Modular parser for spoken Hebrew time.
    -   **Dynamic Onboarding**: Multi-step onboarding flow with behavior mapping and skip mechanisms.

### Temporal Engine (ma_temporal_engine_he_v1)
A comprehensive Hebrew temporal expression parser integrated into the AI's Intent Engine, capable of understanding spoken times, relative dates, durations, intervals, recurrence patterns, and ambiguous expressions, outputting various temporal data types.

### Backend and AI Architecture
The backend is built with Express.js and TypeScript, using PostgreSQL via Prisma. It incorporates a 7-Layer AI architecture for intelligent task management:
1.  **Input Layer**: Text normalization.
2.  **Intent Engine**: Detects language, classifies input, identifies intents, extracts entities, and computes confidence.
3.  **Decision Engine**: Determines AI's action based on confidence and policies.
4.  **Task & Time Engine**: Manages task lifecycle, scheduling, and conflict resolution.
5.  **Learning Engine**: Collects decision data, detects user patterns, and updates models.
6.  **Automation Layer**: Plans and executes external actions.
7.  **Feedback & Review Layer**: Generates reflections, feedback, daily reviews, and micro-step suggestions.

### Mobile App (React Native + Expo)
A companion app with four main screens: Input, Shikul (Check-ins/Choices), Review (Daily Stats), and Settings, providing full access to AI features.

### Synco Brain v1 (AI Learning System)
An AI-powered learning system with long-term memory and adaptive behavior, divided into three zones: Active Brain (real-time processing), Long-term Memory (Qdrant vector database), and Knowledge Library. It uses an 8-service pipeline for ingestion, memory management, local and AI analysis, understanding, policy enforcement, curiosity, and orchestration.

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
-   **Recharts**: Charting library.
-   **Framer Motion**: Animation library.

### Utilities
-   **cmdk**: Command palette.
-   **Vaul**: Drawer component.
-   **next-themes**: Theme switching.
-   **sonner**: Toast notifications.

### AI/Database Integrations
-   **OpenAI**: Used for AI analysis (via Replit AI Integrations for `gpt-4.1-mini`).
-   **Qdrant**: Vector database for long-term memory (user_events, user_insights, user_profile, synco_knowledge collections).
-   **PostgreSQL**: Primary database accessed via Prisma.