/**
 * planningLearningContextService.ts
 * שירות מבודד לבניית Learning Context לשימוש בשיבוץ.
 * Read-only — לא כותב שום דבר ל-DB.
 * מתעלם מ-source="test" כדי שאירועי בדיקה לא ישפיעו על התעדוף.
 */

import { prisma } from '../lib/prisma.js';

export interface MovedTaskHint {
  taskId: string;
  title: string;
  rescheduleCount: number;
  suggestedBoost: number;
  reason: string;
}

export interface PlanningLearningContext {
  enabled: boolean;
  lookbackDays: number;
  timezoneMode: 'utc';
  totalEvents: number;
  topCompletionHours: { hour: number; count: number }[];
  movedTaskHints: MovedTaskHint[];
  warnings: string[];
}

function boostForCount(count: number): number {
  if (count >= 3) return 8;
  if (count === 2) return 5;
  return 3;
}

export async function buildPlanningLearningContext(
  userId: string,
  dateIso: string,
  _tasks: any[] = []
): Promise<PlanningLearningContext> {
  const lookbackDays = 7;
  const toDate   = new Date(`${dateIso}T23:59:59.999Z`);
  const fromDate = new Date(toDate.getTime() - lookbackDays * 86_400_000);

  // Exclude source="test" to prevent test events from affecting real scheduling
  const events = await prisma.learningEvent.findMany({
    where: {
      userId,
      occurredAt: { gte: fromDate, lte: toDate },
      NOT: { source: 'test' },
    },
    orderBy: { occurredAt: 'asc' },
  });

  if (events.length === 0) {
    return {
      enabled: true,
      lookbackDays,
      timezoneMode: 'utc',
      totalEvents: 0,
      topCompletionHours: [],
      movedTaskHints: [],
      warnings: [],
    };
  }

  // ── topCompletionHours ────────────────────────────────────────────────────
  const hourMap = new Map<number, number>();
  let completedCount = 0;
  let rescheduledCount = 0;

  for (const e of events) {
    if (e.eventType === 'task_completed') {
      completedCount++;
      const hour = e.occurredAt.getUTCHours();
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    } else if (e.eventType === 'task_rescheduled') {
      rescheduledCount++;
    }
  }

  const topCompletionHours = [...hourMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, count]) => ({ hour, count }));

  // ── movedTaskHints: group task_rescheduled by taskId, fallback to title ──
  const rescheduleMap = new Map<string, { title: string; count: number; isIdKey: boolean }>();

  for (const e of events) {
    if (e.eventType !== 'task_rescheduled') continue;

    if (e.taskId) {
      const existing = rescheduleMap.get(e.taskId);
      if (existing) {
        existing.count++;
      } else {
        rescheduleMap.set(e.taskId, {
          title:    e.taskTitleSnapshot ?? e.taskId,
          count:    1,
          isIdKey:  true,
        });
      }
    } else if (e.taskTitleSnapshot) {
      const key = `title:${e.taskTitleSnapshot}`;
      const existing = rescheduleMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        rescheduleMap.set(key, {
          title:   e.taskTitleSnapshot,
          count:   1,
          isIdKey: false,
        });
      }
    }
  }

  const movedTaskHints: MovedTaskHint[] = [...rescheduleMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([key, { title, count, isIdKey }]) => ({
      taskId:          isIdKey ? key : '',
      title,
      rescheduleCount: count,
      suggestedBoost:  boostForCount(count),
      reason:          'המשימה הזו זזה כמה פעמים בעבר ולכן כדאי לתת לה מקום ברור',
    }));

  // ── warnings ───────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (rescheduledCount >= 5) {
    warnings.push('זוהו הרבה שינויי זמן לאחרונה, כדאי לתכנן את היום עם יותר מרווחים');
  }
  if (completedCount === 0 && events.length > 0) {
    warnings.push('יש פעילות במערכת אבל לא נמצאו השלמות משימות בתקופה הזו');
  }

  return {
    enabled: true,
    lookbackDays,
    timezoneMode: 'utc',
    totalEvents:        events.length,
    topCompletionHours,
    movedTaskHints,
    warnings,
  };
}
