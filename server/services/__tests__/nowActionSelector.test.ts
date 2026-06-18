import { describe, test, expect } from '@jest/globals';
import {
  isStale,
  scoreTask,
  filterCandidates,
  pickBest,
  buildReason,
  type ScoredTask,
} from '../nowScoringLogic.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number, base = new Date()): Date {
  return new Date(base.getTime() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number, base = new Date()): Date {
  return new Date(base.getTime() + n * 24 * 60 * 60 * 1000);
}

function todayAt(h: number, base = new Date()): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0, 0);
  return d;
}

function makeTask(overrides: Partial<ScoredTask> = {}): ScoredTask {
  return {
    id: 'task-1',
    title: 'Test task',
    priority: 'medium',
    status: 'pending',
    startTime: todayAt(10),
    duration: 30,
    ...overrides,
  };
}

// Fixed "now" for deterministic tests
const NOW = new Date('2026-06-18T12:00:00.000Z');

// ─── isStale ─────────────────────────────────────────────────────────────────

describe('isStale', () => {
  test('task from 8 days ago is stale', () => {
    expect(isStale(daysAgo(8, NOW), NOW)).toBe(true);
  });

  test('task from exactly 7 days ago is NOT stale (boundary — strictly less than cutoff)', () => {
    // cutoff = now - 7*24h; startTime = now - 7*24h → startTime < cutoff is false
    expect(isStale(daysAgo(7, NOW), NOW)).toBe(false);
  });

  test('task from 6 days ago is NOT stale', () => {
    expect(isStale(daysAgo(6, NOW), NOW)).toBe(false);
  });

  test('task from today is NOT stale', () => {
    expect(isStale(new Date(NOW.getTime() - 1000), NOW)).toBe(false);
  });

  test('future task is NOT stale', () => {
    expect(isStale(daysFromNow(1, NOW), NOW)).toBe(false);
  });
});

// ─── filterCandidates ────────────────────────────────────────────────────────

describe('filterCandidates', () => {
  test('excludes completed tasks', () => {
    const tasks = [makeTask({ id: 'c1', status: 'completed', startTime: new Date(NOW) })];
    const { active, staleCount } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(0);
    expect(staleCount).toBe(0);
  });

  test('excludes standby tasks', () => {
    const tasks = [makeTask({ id: 's1', status: 'standby', startTime: new Date(NOW) })];
    const { active } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(0);
  });

  test('excludes stale tasks older than 7 days and counts them', () => {
    const tasks = [
      makeTask({ id: 'stale-1', startTime: daysAgo(10, NOW), status: 'pending' }),
      makeTask({ id: 'stale-2', startTime: daysAgo(30, NOW), status: 'pending' }),
    ];
    const { active, staleCount } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(0);
    expect(staleCount).toBe(2);
  });

  test('excludes tasks in excludedIds set', () => {
    const tasks = [
      makeTask({ id: 'skip', startTime: new Date(NOW), status: 'pending' }),
      makeTask({ id: 'keep', startTime: new Date(NOW), status: 'pending' }),
    ];
    const { active } = filterCandidates(tasks, new Set(['skip']), NOW);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('keep');
  });

  test('keeps recent overdue task (6 days ago)', () => {
    const tasks = [makeTask({ id: 'recent', startTime: daysAgo(6, NOW), status: 'pending' })];
    const { active, staleCount } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(1);
    expect(staleCount).toBe(0);
  });

  test('keeps future pending task', () => {
    const tasks = [makeTask({ id: 'future', startTime: daysFromNow(2, NOW), status: 'pending' })];
    const { active } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(1);
  });

  test('today task passes through', () => {
    const tasks = [makeTask({ id: 'today', startTime: new Date(NOW), status: 'pending' })];
    const { active } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(1);
  });

  test('mixed batch: stale excluded, active kept', () => {
    const tasks = [
      makeTask({ id: 'stale', startTime: daysAgo(20, NOW), status: 'pending' }),
      makeTask({ id: 'active', startTime: new Date(NOW), status: 'pending' }),
    ];
    const { active, staleCount } = filterCandidates(tasks, new Set(), NOW);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('active');
    expect(staleCount).toBe(1);
  });
});

// ─── scoreTask ────────────────────────────────────────────────────────────────

describe('scoreTask', () => {
  // Use a stable "now" that is at noon on June 18 2026 UTC
  const fixedNow = NOW;

  test('high priority scores above medium', () => {
    const high = makeTask({ priority: 'high', startTime: daysFromNow(1, fixedNow) });
    const med = makeTask({ priority: 'medium', startTime: daysFromNow(1, fixedNow) });
    expect(scoreTask(high, fixedNow)).toBeGreaterThan(scoreTask(med, fixedNow));
  });

  test('medium priority scores above low', () => {
    const med = makeTask({ priority: 'medium', startTime: daysFromNow(1, fixedNow) });
    const low = makeTask({ priority: 'low', startTime: daysFromNow(1, fixedNow) });
    expect(scoreTask(med, fixedNow)).toBeGreaterThan(scoreTask(low, fixedNow));
  });

  test('shorter tasks score higher when priority and timing equal', () => {
    const short = makeTask({ duration: 15, startTime: daysFromNow(1, fixedNow) });
    const long = makeTask({ duration: 120, startTime: daysFromNow(1, fixedNow) });
    expect(scoreTask(short, fixedNow)).toBeGreaterThan(scoreTask(long, fixedNow));
  });
});

// ─── pickBest ────────────────────────────────────────────────────────────────

describe('pickBest', () => {
  test('returns null for empty list', () => {
    expect(pickBest([], NOW)).toBeNull();
  });

  test('returns the single task when only one candidate', () => {
    const task = makeTask({ id: 'only' });
    expect(pickBest([task], NOW)?.id).toBe('only');
  });

  test('high priority beats medium with same timing', () => {
    const med = makeTask({ id: 'med', priority: 'medium', startTime: daysFromNow(1, NOW) });
    const high = makeTask({ id: 'high', priority: 'high', startTime: daysFromNow(1, NOW) });
    expect(pickBest([med, high], NOW)?.id).toBe('high');
  });

  test('today task beats future task regardless of priority', () => {
    // today task at fixedNow, future task in 2 days — today gets +30 bonus
    const future = makeTask({ id: 'future', priority: 'high', startTime: daysFromNow(2, NOW) });
    const todayLocal = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 14, 0, 0);
    const todayTask = makeTask({ id: 'today', priority: 'medium', startTime: todayLocal });
    // today: 30(today) + 15(medium) + 5(duration≤30) = 50
    // future: 25(high) + 5(duration≤30) = 30
    expect(pickBest([future, todayTask], NOW)?.id).toBe('today');
  });
});

// ─── buildReason ─────────────────────────────────────────────────────────────

describe('buildReason', () => {
  test('mentions today for a today task', () => {
    const todayLocal = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 10, 0, 0);
    const task = makeTask({ startTime: todayLocal });
    const reason = buildReason(task, 0, NOW);
    expect(reason).toContain('היום');
  });

  test('mentions dchuf for overdue task', () => {
    const task = makeTask({ startTime: daysAgo(3, NOW) });
    const reason = buildReason(task, 0, NOW);
    expect(reason).toContain('דחופה');
  });

  test('mentions stale count when > 0', () => {
    const todayLocal = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 10, 0, 0);
    const task = makeTask({ startTime: todayLocal });
    const reason = buildReason(task, 3, NOW);
    expect(reason).toContain('3');
    expect(reason).toContain('ישנות');
  });

  test('no stale note when staleCount is 0', () => {
    const todayLocal = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 10, 0, 0);
    const task = makeTask({ startTime: todayLocal });
    const reason = buildReason(task, 0, NOW);
    expect(reason).not.toContain('ישנות');
  });
});
