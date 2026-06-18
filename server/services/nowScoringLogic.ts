// Pure scoring and filtering logic for the Now Action Selector.
// No Prisma dependency — fully unit-testable.

export const STALE_DAYS = 7;
export const EXCLUDED_STATUSES = new Set(['completed', 'standby']);

export interface ScoredTask {
  id: string;
  title: string;
  priority: string | null;
  status: string;
  startTime: Date;
  duration: number;
}

export function isStale(startTime: Date, now = new Date()): boolean {
  const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  return startTime < cutoff;
}

export function scoreTask(task: ScoredTask, now = new Date()): number {
  let score = 0;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  if (task.startTime >= todayStart && task.startTime < todayEnd) {
    score += 30;
  }

  if (task.priority === 'high') score += 25;
  else if (task.priority === 'medium') score += 15;
  else if (task.priority === 'low') score += 5;

  // Overdue (not today, but not future)
  if (task.startTime < todayStart) {
    score += 20;
  }

  if (task.duration <= 15) score += 10;
  else if (task.duration <= 30) score += 5;
  else if (task.duration <= 60) score += 2;

  return score;
}

export function buildReason(task: ScoredTask, staleCount: number, now = new Date()): string {
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

export interface FilterResult {
  active: ScoredTask[];
  staleCount: number;
}

export function filterCandidates(
  tasks: ScoredTask[],
  excludedIds: Set<string>,
  now = new Date(),
): FilterResult {
  let staleCount = 0;
  const active: ScoredTask[] = [];

  for (const t of tasks) {
    if (EXCLUDED_STATUSES.has(t.status)) continue;
    if (excludedIds.has(t.id)) continue;
    if (isStale(t.startTime, now)) {
      staleCount++;
      continue;
    }
    active.push(t);
  }

  return { active, staleCount };
}

export function pickBest(candidates: ScoredTask[], now = new Date()): ScoredTask | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map((t) => ({ task: t, score: scoreTask(t, now) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].task;
}
