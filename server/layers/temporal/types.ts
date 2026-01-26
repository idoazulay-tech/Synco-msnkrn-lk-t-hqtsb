/**
 * MA Temporal Engine Types
 * Comprehensive type definitions for Hebrew temporal parsing
 */

export interface TimePoint {
  type: 'timepoint';
  date?: string;
  time: string;
  timezone: string;
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export interface DatePoint {
  type: 'datepoint';
  date: string;
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export interface Duration {
  type: 'duration';
  duration_minutes: number;
  duration_iso?: string;
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export interface Interval {
  type: 'interval';
  start?: string;
  end?: string;
  window?: 'broad' | 'medium' | 'tight';
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export interface RecurrencePattern {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  byDay?: string[];
  interval?: number;
  count?: number;
  until?: string;
  time?: string;
  dayOfMonth?: number;
}

export interface Recurrence {
  type: 'recurrence';
  pattern: RecurrencePattern;
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export interface PreferredWindow {
  label: string;
  startHour: number;
  endHour: number;
}

export interface TemporalHints {
  preferredWindows?: PreferredWindow[];
  softness?: 'hard' | 'soft';
  latest?: string;
}

export interface AmbiguousTime {
  type: 'ambiguous';
  hints: TemporalHints;
  date?: string;
  confidence: number;
  sourceText: string;
  reason?: string;
  needs_clarification?: boolean;
  question?: string;
}

export type TemporalResult = TimePoint | DatePoint | Duration | Interval | Recurrence | AmbiguousTime;

export interface ParseContext {
  now: Date;
  timezone: string;
}

export interface FreeBusySlot {
  start: string;
  end: string;
  status: 'free' | 'busy';
}

export interface SchedulingRules {
  sleepStart?: number;
  sleepEnd?: number;
  minGapMinutes?: number;
  maxTasksPerDay?: number;
  preferMorning?: boolean;
  preferAfternoon?: boolean;
  preferEvening?: boolean;
}

export interface ScheduleSuggestion {
  start: string;
  end: string;
  score: number;
  reason: string;
}
