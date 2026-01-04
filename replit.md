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

### Design Decisions
1. **Client-Side Only**: Currently no backend - all data persists in localStorage via Zustand
2. **RTL Support**: Hebrew language with right-to-left text direction considerations
3. **Mobile-First**: Bottom navigation pattern, touch-friendly UI elements
4. **Timer-Centric**: Core feature is the task timer with percentage and remaining time display

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