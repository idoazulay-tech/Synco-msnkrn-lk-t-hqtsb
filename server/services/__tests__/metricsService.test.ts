import { describe, test, expect } from '@jest/globals';
import {
  computeRates,
  computeConversionRates,
  computeProjectProgress,
  type MetricsTotals,
  type FunnelMetrics,
} from '../metricsComputation.js';

// ── Test 18: /api/metrics/overview totals shape ───────────────────────────────

describe('computeRates', () => {
  test('returns 0 rates when counts are 0', () => {
    const totals: MetricsTotals = {
      intakeCount: 0,
      committedIntakeCount: 0,
      projectCount: 0,
      taskCount: 0,
      completedTaskCount: 0,
      nowActionStartedCount: 0,
      nowActionCompletedCount: 0,
      stuckCount: 0,
      skippedCount: 0,
    };
    const rates = computeRates(totals);
    expect(rates.intakeCommitRate).toBe(0);
    expect(rates.taskCompletionRate).toBe(0);
    expect(rates.nowActionCompletionRate).toBe(0);
  });

  test('calculates correct intakeCommitRate', () => {
    const totals: MetricsTotals = {
      intakeCount: 10,
      committedIntakeCount: 8,
      projectCount: 5,
      taskCount: 20,
      completedTaskCount: 10,
      nowActionStartedCount: 6,
      nowActionCompletedCount: 4,
      stuckCount: 1,
      skippedCount: 1,
    };
    const rates = computeRates(totals);
    expect(rates.intakeCommitRate).toBeCloseTo(0.8);
    expect(rates.taskCompletionRate).toBeCloseTo(0.5);
    expect(rates.nowActionCompletionRate).toBeCloseTo(0.667, 2);
  });

  test('handles 100% completion rates', () => {
    const totals: MetricsTotals = {
      intakeCount: 5,
      committedIntakeCount: 5,
      projectCount: 3,
      taskCount: 10,
      completedTaskCount: 10,
      nowActionStartedCount: 5,
      nowActionCompletedCount: 5,
      stuckCount: 0,
      skippedCount: 0,
    };
    const rates = computeRates(totals);
    expect(rates.intakeCommitRate).toBe(1);
    expect(rates.taskCompletionRate).toBe(1);
    expect(rates.nowActionCompletionRate).toBe(1);
  });
});

// ── Test 19: /api/metrics/funnel conversion rates ─────────────────────────────

describe('computeConversionRates', () => {
  test('returns 0 rates when funnel is empty', () => {
    const funnel: FunnelMetrics = {
      intakePreviewed: 0,
      intakeCommitted: 0,
      nowActionStarted: 0,
      nowActionCompleted: 0,
      nextActionClicked: 0,
    };
    const rates = computeConversionRates(funnel);
    expect(rates.previewToCommit).toBe(0);
    expect(rates.commitToStart).toBe(0);
    expect(rates.startToComplete).toBe(0);
  });

  test('calculates correct funnel conversion rates', () => {
    const funnel: FunnelMetrics = {
      intakePreviewed: 10,
      intakeCommitted: 8,
      nowActionStarted: 6,
      nowActionCompleted: 4,
      nextActionClicked: 3,
    };
    const rates = computeConversionRates(funnel);
    expect(rates.previewToCommit).toBeCloseTo(0.8);
    expect(rates.commitToStart).toBeCloseTo(0.75);
    expect(rates.startToComplete).toBeCloseTo(0.667, 2);
  });

  test('handles perfect funnel conversion', () => {
    const funnel: FunnelMetrics = {
      intakePreviewed: 5,
      intakeCommitted: 5,
      nowActionStarted: 5,
      nowActionCompleted: 5,
      nextActionClicked: 5,
    };
    const rates = computeConversionRates(funnel);
    expect(rates.previewToCommit).toBe(1);
    expect(rates.commitToStart).toBe(1);
    expect(rates.startToComplete).toBe(1);
  });
});

// ── Test 20: /api/metrics/projects progress shape ─────────────────────────────

describe('computeProjectProgress', () => {
  test('returns 0 progress for no steps', () => {
    const progress = computeProjectProgress([], 0, 0);
    expect(progress.totalSteps).toBe(0);
    expect(progress.completedSteps).toBe(0);
    expect(progress.progressRate).toBe(0);
    expect(progress.nextActionTitle).toBeNull();
  });

  test('calculates progress with some completed steps', () => {
    const steps = [
      { status: 'completed', title: 'שלב 1' },
      { status: 'completed', title: 'שלב 2' },
      { status: 'pending',   title: 'שלב 3' },
      { status: 'pending',   title: 'שלב 4' },
    ];
    const progress = computeProjectProgress(steps, 3, 2);
    expect(progress.totalSteps).toBe(4);
    expect(progress.completedSteps).toBe(2);
    expect(progress.progressRate).toBeCloseTo(0.5);
    expect(progress.nextActionTitle).toBe('שלב 3');
  });

  test('returns null nextActionTitle when all steps completed', () => {
    const steps = [
      { status: 'completed', title: 'שלב 1' },
      { status: 'completed', title: 'שלב 2' },
    ];
    const progress = computeProjectProgress(steps, 2, 2);
    expect(progress.progressRate).toBe(1);
    expect(progress.nextActionTitle).toBeNull();
  });

  test('finance project template has 5 steps and first is about listing debts', () => {
    const steps = [
      { status: 'pending', title: 'לרשום את כל החובות והסכומים' },
      { status: 'pending', title: 'לבדוק מצב חשבון הבנק והמינוס הנוכחי' },
      { status: 'pending', title: 'לברר מתי השכירות הקרובה ומה חסר לתשלום' },
      { status: 'pending', title: 'לדרג את החובות לפי דחיפות ותאריך יעד' },
      { status: 'pending', title: 'לתכנן תשלומים ריאליים לפי תזרים' },
    ];
    const progress = computeProjectProgress(steps, 0, 0);
    expect(progress.totalSteps).toBe(5);
    expect(progress.completedSteps).toBe(0);
    expect(progress.progressRate).toBe(0);
    expect(progress.nextActionTitle).toBe('לרשום את כל החובות והסכומים');
  });
});
