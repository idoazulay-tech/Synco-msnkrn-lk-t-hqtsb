/**
 * executionTrackingService.ts
 * שירות עזר לחישוב נתוני זמן ביצוע בפועל.
 * Read-only helpers — לא כותב שום דבר ל-DB ישירות.
 */

export interface ExecutionCompletedMetadata {
  plannedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  durationDeltaMinutes: number | null;
  plannedStartTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
}

/**
 * מחשב זמן ביצוע בפועל בדקות.
 * מחזיר null אם actualEndTime לפני actualStartTime (נתון לא תקין).
 */
export function calculateActualDurationMinutes(
  actualStartTime: string,
  actualEndTime: string
): number | null {
  const start = new Date(actualStartTime).getTime();
  const end   = new Date(actualEndTime).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  if (end <= start) return null;
  return Math.round((end - start) / 60000);
}

/**
 * מחשב הפרש בין זמן מתוכנן לזמן בפועל.
 * ערך חיובי = לקח יותר זמן. שלילי = סיים מוקדם.
 */
export function calculateDurationDeltaMinutes(
  plannedDurationMinutes: number,
  actualDurationMinutes: number
): number {
  return actualDurationMinutes - plannedDurationMinutes;
}

/**
 * בונה metadata מלא לאירוע task_execution_completed.
 */
export function buildExecutionCompletedMetadata(
  plannedDurationMinutes: number | null,
  plannedStartTime: string | null,
  actualStartTime: string | null,
  actualEndTime: string
): ExecutionCompletedMetadata {
  const actualDurationMinutes =
    actualStartTime
      ? calculateActualDurationMinutes(actualStartTime, actualEndTime)
      : null;

  const durationDeltaMinutes =
    plannedDurationMinutes !== null && actualDurationMinutes !== null
      ? calculateDurationDeltaMinutes(plannedDurationMinutes, actualDurationMinutes)
      : null;

  return {
    plannedDurationMinutes,
    actualDurationMinutes,
    durationDeltaMinutes,
    plannedStartTime,
    actualStartTime,
    actualEndTime,
  };
}
