/**
 * learningSummaryService.ts
 * שירות מבודד לחישוב Daily Learning Summary מתוך LearningEvents ב-DB.
 * Read-only — לא כותב שום דבר ל-DB.
 */

import { prisma } from '../lib/prisma.js';

export interface CompletionHour {
  hour: number;
  count: number;
}

export interface MostMovedTask {
  taskId: string;
  title: string;
  rescheduleCount: number;
}

export interface DailyLearningSummary {
  createdCount: number;
  completedCount: number;
  rescheduledCount: number;
  deletedCount: number;
  scheduleAppliedCount: number;
  totalEvents: number;
  completionHours: CompletionHour[];
  mostMovedTasks: MostMovedTask[];
  taskIdsTouched: string[];
  notes: string[];
}

export async function buildDailyLearningSummary(
  userId: string,
  dateIso: string
): Promise<DailyLearningSummary> {
  // ── Query: match by dateIso OR occurredAt falling within the calendar day ──
  const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
  const dayEnd   = new Date(`${dateIso}T23:59:59.999Z`);

  const events = await prisma.learningEvent.findMany({
    where: {
      userId,
      OR: [
        { dateIso },
        {
          dateIso: null,
          occurredAt: { gte: dayStart, lte: dayEnd },
        },
      ],
    },
    orderBy: { occurredAt: 'asc' },
  });

  // ── Empty day ─────────────────────────────────────────────────────────────
  if (events.length === 0) {
    return {
      createdCount: 0,
      completedCount: 0,
      rescheduledCount: 0,
      deletedCount: 0,
      scheduleAppliedCount: 0,
      totalEvents: 0,
      completionHours: [],
      mostMovedTasks: [],
      taskIdsTouched: [],
      notes: ['לא נמצאו אירועי למידה ליום הזה'],
    };
  }

  // ── Counts by eventType ───────────────────────────────────────────────────
  let createdCount = 0;
  let completedCount = 0;
  let rescheduledCount = 0;
  let deletedCount = 0;
  let scheduleAppliedCount = 0;

  for (const e of events) {
    switch (e.eventType) {
      case 'task_created':    createdCount++;         break;
      case 'task_completed':  completedCount++;        break;
      case 'task_rescheduled':rescheduledCount++;      break;
      case 'task_deleted':    deletedCount++;          break;
      case 'schedule_applied':scheduleAppliedCount++;  break;
    }
  }

  // ── completionHours: hour-of-day when task_completed was recorded ─────────
  const hourMap = new Map<number, number>();
  for (const e of events) {
    if (e.eventType !== 'task_completed') continue;
    const hour = e.occurredAt.getUTCHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }
  const completionHours: CompletionHour[] = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  // ── mostMovedTasks: task_rescheduled grouped by taskId ───────────────────
  const rescheduleMap = new Map<string, { title: string; count: number }>();
  for (const e of events) {
    if (e.eventType !== 'task_rescheduled' || !e.taskId) continue;
    const existing = rescheduleMap.get(e.taskId);
    if (existing) {
      existing.count++;
    } else {
      rescheduleMap.set(e.taskId, {
        title: e.taskTitleSnapshot ?? e.taskId,
        count: 1,
      });
    }
  }
  const mostMovedTasks: MostMovedTask[] = [...rescheduleMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([taskId, { title, count }]) => ({
      taskId,
      title,
      rescheduleCount: count,
    }));

  // ── taskIdsTouched: unique non-null taskIds across all events ─────────────
  const touchedSet = new Set<string>();
  for (const e of events) {
    if (e.taskId) touchedSet.add(e.taskId);
  }
  const taskIdsTouched = [...touchedSet];

  // ── notes in Hebrew ───────────────────────────────────────────────────────
  const notes: string[] = [];

  if (completedCount > 0) {
    notes.push(
      completedCount === 1
        ? 'הושלמה משימה אחת ביום הזה'
        : `הושלמו ${completedCount} משימות ביום הזה`
    );
  }
  if (rescheduledCount > 0) {
    notes.push(
      rescheduledCount === 1
        ? 'הייתה שינוי זמן אחד ביום הזה'
        : `היו ${rescheduledCount} שינויי זמן ביום הזה`
    );
  }
  if (deletedCount > 0) {
    notes.push(
      deletedCount === 1
        ? 'נמחקה משימה אחת ביום הזה'
        : `נמחקו ${deletedCount} משימות ביום הזה`
    );
  }
  if (createdCount > 0) {
    notes.push(
      createdCount === 1
        ? 'נוצרה משימה חדשה אחת'
        : `נוצרו ${createdCount} משימות חדשות`
    );
  }
  if (scheduleAppliedCount > 0) {
    notes.push('בוצע שיבוץ יומי אוטומטי');
  }
  if (mostMovedTasks.length > 0 && mostMovedTasks[0].rescheduleCount >= 2) {
    notes.push(
      `"${mostMovedTasks[0].title}" הוזזה ${mostMovedTasks[0].rescheduleCount} פעמים`
    );
  }

  return {
    createdCount,
    completedCount,
    rescheduledCount,
    deletedCount,
    scheduleAppliedCount,
    totalEvents: events.length,
    completionHours,
    mostMovedTasks,
    taskIdsTouched,
    notes,
  };
}
