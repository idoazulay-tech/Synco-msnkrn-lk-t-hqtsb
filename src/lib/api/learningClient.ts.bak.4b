const USER_ID = 'default-user';

export interface LearningEventPayload {
  userId?: string;
  taskId?: string;
  eventType:
    | 'task_created'
    | 'task_completed'
    | 'task_rescheduled'
    | 'task_deleted'
    | 'schedule_applied'
    | 'task_updated'
    | 'task_started'
    | 'task_execution_completed';
  source?: string;
  dateIso?: string;
  taskTitleSnapshot?: string;
  fromStatus?: string;
  toStatus?: string;
  fromStartTime?: string;
  toStartTime?: string;
  fromEndTime?: string;
  toEndTime?: string;
  metadata?: Record<string, unknown>;
}

export interface LearningEventRecord {
  id: string;
  userId: string;
  taskId?: string;
  eventType: string;
  source?: string;
  occurredAt: string;
  dateIso?: string;
  taskTitleSnapshot?: string;
  fromStatus?: string;
  toStatus?: string;
  fromStartTime?: string;
  toStartTime?: string;
  fromEndTime?: string;
  toEndTime?: string;
  metadata?: Record<string, unknown>;
}

/**
 * שומר learning event — fire-and-forget.
 * כישלון לא שובר שום פעולת משתמש.
 */
export function logLearningEvent(payload: LearningEventPayload): void {
  const body: LearningEventPayload = { userId: USER_ID, ...payload };

  fetch('/api/learning/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((e) => {
    console.warn('[learningClient] logLearningEvent failed (silent):', e);
  });
}

/**
 * מתעד שהמשתמש התחיל לבצע משימה — fire-and-forget.
 */
export function logTaskStarted(payload: {
  taskId: string;
  taskTitleSnapshot?: string;
  dateIso?: string;
  plannedDurationMinutes?: number | null;
  plannedStartTime?: string | null;
  actualStartTime: string;
}): void {
  logLearningEvent({
    taskId: payload.taskId,
    eventType: 'task_started',
    source: 'timer',
    taskTitleSnapshot: payload.taskTitleSnapshot,
    dateIso: payload.dateIso,
    metadata: {
      plannedDurationMinutes: payload.plannedDurationMinutes ?? null,
      plannedStartTime: payload.plannedStartTime ?? null,
      actualStartTime: payload.actualStartTime,
    },
  });
}

/**
 * מתעד השלמת ביצוע עם נתוני זמן מלאים — fire-and-forget.
 */
export function logTaskExecutionCompleted(payload: {
  taskId: string;
  taskTitleSnapshot?: string;
  dateIso?: string;
  plannedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  durationDeltaMinutes?: number | null;
  plannedStartTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime: string;
}): void {
  logLearningEvent({
    taskId: payload.taskId,
    eventType: 'task_execution_completed',
    source: 'completeTask',
    taskTitleSnapshot: payload.taskTitleSnapshot,
    dateIso: payload.dateIso,
    metadata: {
      plannedDurationMinutes: payload.plannedDurationMinutes ?? null,
      actualDurationMinutes: payload.actualDurationMinutes ?? null,
      durationDeltaMinutes: payload.durationDeltaMinutes ?? null,
      plannedStartTime: payload.plannedStartTime ?? null,
      actualStartTime: payload.actualStartTime ?? null,
      actualEndTime: payload.actualEndTime,
    },
  });
}

/**
 * מחזיר את ה-events האחרונים לצורך בדיקה בלבד.
 */
export async function getLearningEvents(
  userId = USER_ID,
  limit = 50
): Promise<LearningEventRecord[]> {
  try {
    const res = await fetch(`/api/learning/events?userId=${userId}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch (e) {
    console.warn('[learningClient] getLearningEvents failed:', e);
    return [];
  }
}

export interface ExecutionStats {
  trackedCompletedCount: number;
  averagePlannedDurationMinutes: number | null;
  averageActualDurationMinutes: number | null;
  averageDeltaMinutes: number | null;
  overranCount: number;
  underranCount: number;
}

export interface DailySummaryResult {
  ok: boolean;
  userId: string;
  date: string;
  summary: {
    createdCount: number;
    completedCount: number;
    rescheduledCount: number;
    deletedCount: number;
    scheduleAppliedCount: number;
    totalEvents: number;
    completionHours: { hour: number; count: number }[];
    mostMovedTasks: { taskId: string; title: string; rescheduleCount: number }[];
    taskIdsTouched: string[];
    notes: string[];
    executionStats: ExecutionStats | null;
  };
}

/**
 * מחזיר סיכום יומי מחושב מתוך LearningEvents.
 * לא מחובר ל-UI עדיין — לשימוש עתידי בשלב 3ב.
 */
export async function getDailyLearningSummary(
  dateIso: string,
  userId = USER_ID
): Promise<DailySummaryResult | null> {
  try {
    const res = await fetch(
      `/api/learning/daily-summary?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateIso)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[learningClient] getDailyLearningSummary failed:', e);
    return null;
  }
}
