/**
 * metricsService.ts
 *
 * DB query layer for product metrics.
 * Pure computation is in metricsComputation.ts (testable without DB).
 */

import { prisma } from '../lib/prisma.js';
import {
  computeRates,
  computeConversionRates,
  computeProjectProgress,
} from './metricsComputation.js';

export type {
  MetricsTotals,
  MetricsRates,
  FunnelMetrics,
  ConversionRates,
  ProjectProgress,
} from './metricsComputation.js';

export { computeRates, computeConversionRates, computeProjectProgress } from './metricsComputation.js';

import type { MetricsTotals, FunnelMetrics, ProjectProgress } from './metricsComputation.js';

export async function getOverview(userId: string): Promise<{
  totals: MetricsTotals;
  rates: ReturnType<typeof computeRates>;
}> {
  const EVENT_TYPES = ['now_action_started', 'now_action_completed', 'now_action_stuck', 'now_action_skipped'];

  const [
    intakeCount,
    committedIntakeCount,
    projectCount,
    taskCount,
    completedTaskCount,
    eventCounts,
  ] = await Promise.all([
    prisma.intakeRecord.count({ where: { userId } }),
    prisma.intakeRecord.count({ where: { userId, status: 'committed' } }),
    prisma.project.count({ where: { userId } }),
    prisma.userTask.count({ where: { userId, deletedAt: null } }),
    prisma.userTask.count({ where: { userId, deletedAt: null, status: 'completed' } }),
    prisma.learningEvent.groupBy({
      by: ['eventType'],
      where: { userId, eventType: { in: EVENT_TYPES } },
      _count: { eventType: true },
    }),
  ]);

  const eventMap: Record<string, number> = {};
  for (const row of eventCounts) {
    eventMap[row.eventType] = row._count.eventType;
  }

  const totals: MetricsTotals = {
    intakeCount,
    committedIntakeCount,
    projectCount,
    taskCount,
    completedTaskCount,
    nowActionStartedCount:   eventMap['now_action_started']   ?? 0,
    nowActionCompletedCount: eventMap['now_action_completed'] ?? 0,
    stuckCount:              eventMap['now_action_stuck']     ?? 0,
    skippedCount:            eventMap['now_action_skipped']   ?? 0,
  };

  return { totals, rates: computeRates(totals) };
}

export async function getFunnel(userId: string): Promise<{
  funnel: FunnelMetrics;
  conversionRates: ReturnType<typeof computeConversionRates>;
}> {
  const FUNNEL_TYPES = [
    'intake_previewed',
    'intake_committed',
    'now_action_started',
    'now_action_completed',
    'next_action_clicked',
  ];

  const rows = await prisma.learningEvent.groupBy({
    by: ['eventType'],
    where: { userId, eventType: { in: FUNNEL_TYPES } },
    _count: { eventType: true },
  });

  const m: Record<string, number> = {};
  for (const row of rows) m[row.eventType] = row._count.eventType;

  const funnel: FunnelMetrics = {
    intakePreviewed:   m['intake_previewed']     ?? 0,
    intakeCommitted:   m['intake_committed']     ?? 0,
    nowActionStarted:  m['now_action_started']   ?? 0,
    nowActionCompleted: m['now_action_completed'] ?? 0,
    nextActionClicked: m['next_action_clicked']  ?? 0,
  };

  return { funnel, conversionRates: computeConversionRates(funnel) };
}

export async function getProjectMetrics(userId: string): Promise<ProjectProgress[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { steps: { orderBy: { orderIndex: 'asc' } } },
  });

  if (projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);
  const tasks = await prisma.userTask.findMany({
    where: { userId, projectId: { in: projectIds }, deletedAt: null },
    select: { projectId: true, status: true },
  });

  const tasksByProject = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.projectId) continue;
    if (!tasksByProject.has(t.projectId)) tasksByProject.set(t.projectId, []);
    tasksByProject.get(t.projectId)!.push(t);
  }

  return projects.map(proj => {
    const projTasks = tasksByProject.get(proj.id) ?? [];
    const completedLinkedTasks = projTasks.filter(t => t.status === 'completed').length;
    const progress = computeProjectProgress(proj.steps, projTasks.length, completedLinkedTasks);
    return {
      projectId:            proj.id,
      title:                proj.title,
      linkedTasks:          projTasks.length,
      completedLinkedTasks,
      ...progress,
    };
  });
}
