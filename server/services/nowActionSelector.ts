import { prisma } from '../lib/prisma.js';

export interface NowActionResult {
  task: {
    id: string;
    title: string;
    priority: string | null;
    status: string;
    startTime: Date;
    duration: number;
  } | null;
  reason: string;
  candidateCount: number;
  staleCount: number;
}

const STALE_DAYS = 7;
const EXCLUDED_STATUSES = new Set(['completed', 'standby']);

function isStale(startTime: Date): boolean {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  return startTime < cutoff;
}

function scoreTask(task: {
  priority: string | null;
  startTime: Date;
  duration: number;
}): number {
  let score = 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Today
  if (task.startTime >= todayStart && task.startTime < todayEnd) {
    score += 30;
  }

  // Priority
  if (task.priority === 'high') score += 25;
  else if (task.priority === 'medium') score += 15;
  else if (task.priority === 'low') score += 5;

  // Recent overdue (within last 7 days — already filtered, so any negative startTime here is recent)
  if (task.startTime < now && task.startTime >= todayStart === false) {
    score += 20;
  }

  // Duration bonus (shorter = easier to start)
  if (task.duration <= 15) score += 10;
  else if (task.duration <= 30) score += 5;
  else if (task.duration <= 60) score += 2;

  return score;
}

function buildReason(task: {
  priority: string | null;
  startTime: Date;
  duration: number;
}, staleCount: number): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let reason = '';

  if (task.startTime >= todayStart && task.startTime < todayEnd) {
    reason = 'זו פעולה טובה להתחלה כי היא מתוכננת להיום.';
  } else if (task.startTime < now) {
    reason = 'זו פעולה טובה להתחלה כי היא דחופה ועדיין רלוונטית.';
  } else if (task.duration <= 30) {
    reason = 'זו פעולה קצרה יחסית שיכולה לפתוח תנועה.';
  } else {
    reason = 'זו נראית הפעולה הכי מתאימה להתחיל ממנה עכשיו.';
  }

  if (staleCount > 0) {
    reason += ` (${staleCount} משימות ישנות לא נכללו כי כנראה כבר לא רלוונטיות.)`;
  }

  return reason;
}

export async function selectNowAction(
  userId: string,
  excludedTaskIds: string[] = [],
): Promise<NowActionResult> {
  const allOpen = await prisma.userTask.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
      startTime: true,
      duration: true,
    },
  });

  // Split into stale vs active
  let staleCount = 0;
  const excludedSet = new Set(excludedTaskIds);

  const active = allOpen.filter((t) => {
    if (EXCLUDED_STATUSES.has(t.status)) return false;
    if (excludedSet.has(t.id)) return false;
    if (isStale(t.startTime)) {
      staleCount++;
      return false;
    }
    return true;
  });

  if (active.length === 0) {
    const emptyReason = staleCount > 0
      ? `אין משימות פתוחות רלוונטיות כרגע. (${staleCount} משימות ישנות לא נכללו כי כנראה כבר לא רלוונטיות.)`
      : 'אין משימות פתוחות כרגע.';
    return { task: null, reason: emptyReason, candidateCount: 0, staleCount };
  }

  const scored = active.map((t) => ({ task: t, score: scoreTask(t) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].task;

  return {
    task: best,
    reason: buildReason(best, staleCount),
    candidateCount: active.length,
    staleCount,
  };
}
