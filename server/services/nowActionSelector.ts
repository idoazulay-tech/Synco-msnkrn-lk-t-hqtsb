import { prisma } from '../lib/prisma.js';
import { filterCandidates, pickBest, buildReason } from './nowScoringLogic.js';

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

  const excludedSet = new Set(excludedTaskIds);
  const { active, staleCount } = filterCandidates(allOpen, excludedSet);

  if (active.length === 0) {
    const emptyReason = staleCount > 0
      ? `אין משימות פתוחות רלוונטיות כרגע. (${staleCount} משימות ישנות לא נכללו כי כנראה כבר לא רלוונטיות.)`
      : 'אין משימות פתוחות כרגע.';
    return { task: null, reason: emptyReason, candidateCount: 0, staleCount };
  }

  const best = pickBest(active);
  if (!best) {
    return { task: null, reason: 'אין משימות פתוחות כרגע.', candidateCount: 0, staleCount };
  }

  return {
    task: best,
    reason: buildReason(best, staleCount),
    candidateCount: active.length,
    staleCount,
  };
}
