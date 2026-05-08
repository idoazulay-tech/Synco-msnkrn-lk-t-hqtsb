/**
 * planningTimeGuardService.ts
 *
 * No Past Scheduling Guard — Stage 3ב.1
 * מונע שיבוץ משימות בזמן שכבר עבר היום.
 * מבודד לחלוטין: לא נוגע ב-schedulePlanner, buildSchedule, priorityScoreEngine, DB.
 *
 * כל הפעולות read-only — מחזירות values חדשים, לא מ-mutate.
 */

import type { ScheduleConfig } from '../layers/task/types/scheduleTypes.js';

const BUFFER_MINUTES = 5;

export interface NowContext {
  nowIso: string;
  userTimeZone: string;
  timezoneOffsetMinutes: number;
  dateIso: string;
  isToday: boolean;
  earliestAllowedHour: number;
  earliestAllowedMinute: number;
  earliestAllowedIso: string;
}

/**
 * buildNowContext
 * בונה הקשר "עכשיו" לשימוש ב-No Past guard.
 *
 * timezoneOffsetMinutes = new Date().getTimezoneOffset() מהלקוח.
 * לישראל UTC+2 ערך זה הוא −120 (כי getTimezoneOffset מחזיר UTC − local).
 * לכן: localMs = nowMs − offset × 60_000
 * לישראל: localMs = nowMs + 120 × 60_000 (= UTC + 2h) ✓
 */
export function buildNowContext(
  dateIso: string,
  nowIso: string | undefined | null,
  userTimeZone: string | undefined | null,
  timezoneOffsetMinutes: number | undefined | null,
): NowContext {
  const resolvedNowIso = nowIso ?? new Date().toISOString();
  const resolvedTZ = userTimeZone ?? 'Asia/Jerusalem';
  // Israel UTC+2 → getTimezoneOffset() = −120
  const resolvedOffset = typeof timezoneOffsetMinutes === 'number' ? timezoneOffsetMinutes : -120;

  const now = new Date(resolvedNowIso);
  const nowMs = now.getTime();

  // ── isToday: compare dateIso with user local date ──────────────────────────
  const localMs = nowMs - resolvedOffset * 60_000;
  const localDateIso = new Date(localMs).toISOString().split('T')[0];
  const isToday = localDateIso === dateIso;

  // ── earliestAllowed: UTC time = now + buffer ────────────────────────────────
  // schedulePlanner is UTC-based, so we stay in UTC
  const earliestMs = nowMs + BUFFER_MINUTES * 60_000;
  const earliestDate = new Date(earliestMs);
  const earliestAllowedHour = earliestDate.getUTCHours();
  const earliestAllowedMinute = earliestDate.getUTCMinutes();
  const earliestAllowedIso = `${dateIso}T${String(earliestAllowedHour).padStart(2, '0')}:${String(earliestAllowedMinute).padStart(2, '0')}:00.000Z`;

  return {
    nowIso: resolvedNowIso,
    userTimeZone: resolvedTZ,
    timezoneOffsetMinutes: resolvedOffset,
    dateIso,
    isToday,
    earliestAllowedHour,
    earliestAllowedMinute,
    earliestAllowedIso,
  };
}

/**
 * isTodayForUser
 * בודק האם dateIso הוא היום המקומי של המשתמש.
 */
export function isTodayForUser(dateIso: string, nowContext: NowContext): boolean {
  return nowContext.isToday && nowContext.dateIso === dateIso;
}

/**
 * getEarliestAllowedTimeString
 * מחזיר את הזמן המוקדם ביותר לשיבוץ בפורמט "HH:MM" (UTC).
 */
export function getEarliestAllowedTimeString(nowContext: NowContext): string {
  const h = String(nowContext.earliestAllowedHour).padStart(2, '0');
  const m = String(nowContext.earliestAllowedMinute).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * applyNoPastSchedulingConfig
 * אם dateIso הוא היום ו-now מאוחר מה-dayStart הקונפיגורציה,
 * מעדכן dayStartHour + dayStartMinute כך שהשיבוץ יתחיל רק אחרי now + 5 דקות.
 * מחזיר config חדש — לא מ-mutate את המקור.
 */
export function applyNoPastSchedulingConfig(
  config: ScheduleConfig,
  nowContext: NowContext,
): ScheduleConfig {
  if (!nowContext.isToday) return config;

  const configTotalMinutes = config.dayStartHour * 60 + (config.dayStartMinute ?? 0);
  const earliestTotalMinutes =
    nowContext.earliestAllowedHour * 60 + nowContext.earliestAllowedMinute;

  if (earliestTotalMinutes <= configTotalMinutes) {
    return config; // dayStart is already after now — no change needed
  }

  return {
    ...config,
    dayStartHour: nowContext.earliestAllowedHour,
    dayStartMinute: nowContext.earliestAllowedMinute,
  };
}

/**
 * isPastFixedTask
 * בודק האם משימה fixed עם startTime כבר עברה היום.
 * אם כן — לא ישובצו שוב בעבר.
 */
export function isPastFixedTask(task: Record<string, any>, nowContext: NowContext): boolean {
  if (!nowContext.isToday) return false;
  const flexibility = (task.flexibility ?? '').toLowerCase();
  if (flexibility !== 'fixed') return false;

  const startRaw = task.startTime;
  if (!startRaw) return false;

  const startIso =
    startRaw instanceof Date ? startRaw.toISOString() : String(startRaw);

  return startIso < nowContext.nowIso;
}
