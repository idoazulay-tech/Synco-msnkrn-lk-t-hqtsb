/**
 * metricsComputation.ts
 *
 * Pure computation functions for metrics — no Prisma, fully testable.
 * Imported by both metricsService.ts (DB layer) and tests.
 */

export interface MetricsTotals {
  intakeCount: number;
  committedIntakeCount: number;
  projectCount: number;
  taskCount: number;
  completedTaskCount: number;
  nowActionStartedCount: number;
  nowActionCompletedCount: number;
  stuckCount: number;
  skippedCount: number;
}

export interface MetricsRates {
  intakeCommitRate: number;
  taskCompletionRate: number;
  nowActionCompletionRate: number;
}

export interface FunnelMetrics {
  intakePreviewed: number;
  intakeCommitted: number;
  nowActionStarted: number;
  nowActionCompleted: number;
  nextActionClicked: number;
}

export interface ConversionRates {
  previewToCommit: number;
  commitToStart: number;
  startToComplete: number;
}

export interface ProjectProgress {
  projectId: string;
  title: string;
  totalSteps: number;
  completedSteps: number;
  linkedTasks: number;
  completedLinkedTasks: number;
  progressRate: number;
  nextActionTitle: string | null;
}

export function computeRates(totals: MetricsTotals): MetricsRates {
  return {
    intakeCommitRate: totals.intakeCount > 0
      ? totals.committedIntakeCount / totals.intakeCount
      : 0,
    taskCompletionRate: totals.taskCount > 0
      ? totals.completedTaskCount / totals.taskCount
      : 0,
    nowActionCompletionRate: totals.nowActionStartedCount > 0
      ? totals.nowActionCompletedCount / totals.nowActionStartedCount
      : 0,
  };
}

export function computeConversionRates(funnel: FunnelMetrics): ConversionRates {
  return {
    previewToCommit: funnel.intakePreviewed > 0
      ? funnel.intakeCommitted / funnel.intakePreviewed
      : 0,
    commitToStart: funnel.intakeCommitted > 0
      ? funnel.nowActionStarted / funnel.intakeCommitted
      : 0,
    startToComplete: funnel.nowActionStarted > 0
      ? funnel.nowActionCompleted / funnel.nowActionStarted
      : 0,
  };
}

export function computeProjectProgress(
  steps: Array<{ status: string; title: string }>,
  _taskCount: number,
  _completedTaskCount: number,
): Omit<ProjectProgress, 'projectId' | 'title' | 'linkedTasks' | 'completedLinkedTasks'> {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const nextStep = steps.find(s => s.status !== 'completed');
  return {
    totalSteps:      steps.length,
    completedSteps,
    progressRate:    steps.length > 0 ? completedSteps / steps.length : 0,
    nextActionTitle: nextStep?.title ?? null,
  };
}
