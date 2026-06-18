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
}

function scoreTask(task: {
  priority: string | null;
  startTime: Date;
  duration: number;
}): number {
  let score = 0;

  // Priority
  if (task.priority === 'high') score += 30;
  else if (task.priority === 'medium') score += 20;
  else if (task.priority === 'low') score += 10;
  else score += 5;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Overdue bonus
  if (task.startTime < now) {
    score += 20;
  }
  // Scheduled for today bonus
  else if (task.startTime >= todayStart && task.startTime < todayEnd) {
    score += 15;
  }

  // Shorter tasks get a small bonus (max +10 for <=15 min)
  if (task.duration <= 15) score += 10;
  else if (task.duration <= 30) score += 5;
  else if (task.duration <= 60) score += 2;

  return score;
}

function buildReason(task: {
  priority: string | null;
  startTime: Date;
  duration: number;
}): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  if (task.startTime < now || task.priority === 'high') {
    return 'זו נראית הפעולה הכי מתאימה להתחיל ממנה עכשיו כי היא דחופה וקצרה יחסית.';
  }
  if (task.startTime >= todayStart && task.startTime < todayEnd) {
    return 'זו פעולה טובה להתחלה כי היא כבר מתוכננת להיום.';
  }
  return 'זו נראית הפעולה הכי מתאימה להתחיל ממנה עכשיו כי היא דחופה וקצרה יחסית.';
}

export async function selectNowAction(userId: string): Promise<NowActionResult> {
  const candidates = await prisma.userTask.findMany({
    where: {
      userId,
      deletedAt: null,
      NOT: { status: 'completed' },
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

  if (candidates.length === 0) {
    return { task: null, reason: 'אין משימות פתוחות כרגע.', candidateCount: 0 };
  }

  const scored = candidates.map(t => ({ task: t, score: scoreTask(t) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].task;

  return {
    task: best,
    reason: buildReason(best),
    candidateCount: candidates.length,
  };
}
