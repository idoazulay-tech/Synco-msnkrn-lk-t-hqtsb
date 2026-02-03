/**
 * Outcome Anchor & Backward Planning Layer Tests
 * 
 * בדיקות חובה:
 * 1. תכנון בוקר עם יציאה בזמן
 * 2. משימות מילוי לא דוחקות הכנה ליציאה
 * 3. התרעה כשאין זמן להגיע לתוצאה
 * 4. HARD_LOCK של Outcome לא זז
 */

import { describe, it, expect } from 'vitest';
import {
  detectOutcomeFromText,
  createOutcomeAnchor,
  buildBackwardPlan,
  enforceOutcomeAnchorLayer,
  canFillGapsBumpLinked,
  checkChainIntegrity,
  OutcomeScheduleState,
  OutcomeOperation,
  LinkedTask
} from '../index';
import { TimeConstraintType } from '../../timeConstraints/types';

describe('Outcome Detection', () => {
  it('should detect "צריך לצאת ב-08:30" as outcome', () => {
    const result = detectOutcomeFromText('צריך לצאת ב-08:30');
    
    expect(result.isOutcome).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.deadlineTime).toBeDefined();
    expect(result.deadlineTime?.getHours()).toBe(8);
    expect(result.deadlineTime?.getMinutes()).toBe(30);
  });

  it('should detect "יש לי אוטובוס ב-7"', () => {
    const result = detectOutcomeFromText('יש לי אוטובוס ב-7');
    
    expect(result.isOutcome).toBe(true);
    expect(result.triggerPhrase).toContain('אוטובוס');
  });

  it('should detect "העבודה מתחילה ב-9"', () => {
    const result = detectOutcomeFromText('העבודה מתחילה ב-9');
    
    expect(result.isOutcome).toBe(true);
    expect(result.suggestedBuffer).toBe(15);
  });

  it('should not detect regular task as outcome', () => {
    const result = detectOutcomeFromText('לקנות חלב');
    
    expect(result.isOutcome).toBe(false);
  });

  it('should suggest higher buffer for flights', () => {
    const result = detectOutcomeFromText('הטיסה ב-6 בבוקר');
    
    expect(result.isOutcome).toBe(true);
    expect(result.suggestedBuffer).toBe(30);
  });
});

describe('Backward Planning', () => {
  it('should plan morning routine backwards from departure', () => {
    const currentTime = new Date('2026-01-27T06:00:00');
    const deadline = new Date('2026-01-27T08:30:00');
    
    const outcome = createOutcomeAnchor('יציאה לעבודה', deadline, {
      bufferMinutes: 15
    });
    
    const tasks = [
      { title: 'להתקלח', durationMinutes: 15 },
      { title: 'להתלבש', durationMinutes: 10 },
      { title: 'ארוחת בוקר', durationMinutes: 20 },
      { title: 'להתארגן', durationMinutes: 15 }
    ];
    
    const plan = buildBackwardPlan(outcome, tasks, currentTime);
    
    expect(plan.hasEnoughTime).toBe(true);
    expect(plan.tasks.length).toBe(4);
    expect(plan.tasks[0].title).toBe('להתקלח');
    expect(plan.tasks[plan.tasks.length - 1].title).toBe('להתארגן');
    
    const firstTaskEnd = new Date(plan.tasks[0].latestEnd);
    const lastTaskEnd = new Date(plan.tasks[plan.tasks.length - 1].latestEnd);
    
    expect(lastTaskEnd.getTime()).toBeLessThanOrEqual(
      deadline.getTime() - 15 * 60 * 1000
    );
  });

  it('should warn when not enough time to reach outcome', () => {
    const currentTime = new Date('2026-01-27T08:00:00');
    const deadline = new Date('2026-01-27T08:30:00');
    
    const outcome = createOutcomeAnchor('יציאה', deadline, {
      bufferMinutes: 10
    });
    
    const tasks = [
      { title: 'להתקלח', durationMinutes: 20 },
      { title: 'להתלבש', durationMinutes: 15 },
      { title: 'ארוחת בוקר', durationMinutes: 20 }
    ];
    
    const plan = buildBackwardPlan(outcome, tasks, currentTime);
    
    expect(plan.hasEnoughTime).toBe(false);
    expect(plan.shortfallMinutes).toBeGreaterThan(0);
  });
});

describe('Outcome Gate - HARD_LOCK protection', () => {
  const now = new Date('2026-01-27T07:00:00');
  const deadline = new Date('2026-01-27T08:30:00');
  
  const createState = (): OutcomeScheduleState => {
    const outcome = createOutcomeAnchor('יציאה לעבודה', deadline);
    
    const linkedTask: LinkedTask = {
      id: 'prep-1',
      title: 'התארגנות',
      durationMinutes: 30,
      order: 1,
      linkedOutcomeId: outcome.id,
      latestEnd: new Date('2026-01-27T08:15:00'),
      isFlexible: false
    };
    
    return {
      currentTime: now,
      outcomes: [outcome],
      linkedTasks: [linkedTask],
      allTasks: [{
        id: 'prep-1',
        title: 'התארגנות',
        startTime: new Date('2026-01-27T07:45:00'),
        endTime: new Date('2026-01-27T08:15:00'),
        linkedOutcomeId: outcome.id,
        timeConstraint: TimeConstraintType.HARD_LOCK
      }]
    };
  };

  it('should block automatic move of outcome HARD_LOCK', () => {
    const state = createState();
    const operation: OutcomeOperation = {
      operationType: 'reschedule_outcome',
      outcomeId: state.outcomes[0].id,
      isAutomatic: true
    };

    const decision = enforceOutcomeAnchorLayer(state, operation);
    
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('HARD_LOCK');
  });

  it('should block deletion of linked task', () => {
    const state = createState();
    const operation: OutcomeOperation = {
      operationType: 'delete_task',
      taskId: 'prep-1',
      isAutomatic: true
    };

    const decision = enforceOutcomeAnchorLayer(state, operation);
    
    expect(decision.allowed).toBe(false);
    expect(decision.chainBreakType).toBe('removes_linked');
  });

  it('should block move that causes deadline breach', () => {
    const state = createState();
    const operation: OutcomeOperation = {
      operationType: 'move_task',
      taskId: 'prep-1',
      proposedStartTime: new Date('2026-01-27T08:00:00'),
      proposedEndTime: new Date('2026-01-27T08:30:00'),
      isAutomatic: false
    };

    const decision = enforceOutcomeAnchorLayer(state, operation);
    
    expect(decision.allowed).toBe(false);
    expect(decision.chainBreakType).toBe('deadline_breach');
  });
});

describe('FILL_GAPS cannot bump linked tasks', () => {
  it('should never allow FILL_GAPS to bump linked preparation tasks', () => {
    const linkedTask: LinkedTask = {
      id: 'prep-1',
      title: 'התארגנות ליציאה',
      durationMinutes: 30,
      order: 1,
      linkedOutcomeId: 'outcome-1',
      latestEnd: new Date('2026-01-27T08:15:00'),
      isFlexible: false
    };
    
    const fillGapsTask = {
      id: 'fill-1',
      title: 'לקרוא ספר'
    };

    const canBump = canFillGapsBumpLinked(fillGapsTask, linkedTask);
    
    expect(canBump).toBe(false);
  });
});

describe('Chain Integrity', () => {
  it('should detect broken chain when task is missing', () => {
    const now = new Date('2026-01-27T07:00:00');
    const deadline = new Date('2026-01-27T08:30:00');
    const outcome = createOutcomeAnchor('יציאה', deadline);
    
    const linkedTask: LinkedTask = {
      id: 'missing-task',
      title: 'משימה חסרה',
      durationMinutes: 15,
      order: 1,
      linkedOutcomeId: outcome.id,
      latestEnd: new Date('2026-01-27T08:15:00'),
      isFlexible: false
    };
    
    const state: OutcomeScheduleState = {
      currentTime: now,
      outcomes: [outcome],
      linkedTasks: [linkedTask],
      allTasks: []
    };

    const integrity = checkChainIntegrity(state, outcome.id);
    
    expect(integrity.isIntact).toBe(false);
    expect(integrity.brokenLinks.length).toBeGreaterThan(0);
  });

  it('should confirm intact chain when all tasks are scheduled correctly', () => {
    const now = new Date('2026-01-27T07:00:00');
    const deadline = new Date('2026-01-27T08:30:00');
    const outcome = createOutcomeAnchor('יציאה', deadline);
    
    const linkedTask: LinkedTask = {
      id: 'prep-1',
      title: 'התארגנות',
      durationMinutes: 30,
      order: 1,
      linkedOutcomeId: outcome.id,
      latestEnd: new Date('2026-01-27T08:15:00'),
      isFlexible: false
    };
    
    const state: OutcomeScheduleState = {
      currentTime: now,
      outcomes: [outcome],
      linkedTasks: [linkedTask],
      allTasks: [{
        id: 'prep-1',
        title: 'התארגנות',
        startTime: new Date('2026-01-27T07:45:00'),
        endTime: new Date('2026-01-27T08:15:00'),
        linkedOutcomeId: outcome.id,
        timeConstraint: TimeConstraintType.HARD_LOCK
      }]
    };

    const integrity = checkChainIntegrity(state, outcome.id);
    
    expect(integrity.isIntact).toBe(true);
  });
});
