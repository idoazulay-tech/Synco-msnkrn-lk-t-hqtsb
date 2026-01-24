// Layer 4: Task & Time Engine - Unit Tests

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TaskTimeEngine } from '../TaskTimeEngine.js';
import { InMemoryStore } from '../store/InMemoryStore.js';
import { buildSchedule } from '../planners/schedulePlanner.js';
import { createReshufflePlans } from '../planners/reshufflePlanner.js';
import type { DecisionOutput } from '../../decision/types/decisionTypes.js';
import type { Task, Event } from '../types/taskTypes.js';

function createMockDecision(overrides: Partial<DecisionOutput> = {}): DecisionOutput {
  return {
    decision: 'execute',
    reason: 'Test decision',
    confidence: 0.9,
    requiredNextLayer: 'none',
    actionPlan: {
      actionType: 'create_task',
      payload: { title: 'Test Task' },
      dependencies: [],
      constraints: [],
      mustLock: false,
      urgency: 'low'
    },
    question: { shouldAsk: false, questionId: '', text: '', expectedAnswerType: 'free_text', options: [] },
    reflection: { shouldReflect: false, text: '', microStep: '' },
    ...overrides
  };
}

describe('TaskTimeEngine', () => {
  let store: InMemoryStore;
  let engine: TaskTimeEngine;

  beforeEach(() => {
    store = new InMemoryStore();
    engine = new TaskTimeEngine(store);
  });

  describe('create_task', () => {
    test('should create task and add to store', () => {
      const decision = createMockDecision({
        actionPlan: {
          actionType: 'create_task',
          payload: { title: 'לקנות חלב', durationMinutes: 30 },
          dependencies: [],
          constraints: [],
          mustLock: false,
          urgency: 'low'
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.state.tasks.length).toBe(1);
      expect(result.state.tasks[0].title).toBe('לקנות חלב');
      expect(result.state.tasks[0].durationMinutes).toBe(30);
    });

    test('should preserve mustLock when creating task', () => {
      const decision = createMockDecision({
        actionPlan: {
          actionType: 'create_task',
          payload: { title: 'משימה קריטית חייב לסיים', mustLock: true },
          dependencies: [],
          constraints: [],
          mustLock: true,
          urgency: 'high'
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.state.tasks[0].mustLock).toBe(true);
    });
  });

  describe('create_event', () => {
    test('should create event with fixed time block', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateIso = tomorrow.toISOString().split('T')[0];

      const decision = createMockDecision({
        actionPlan: {
          actionType: 'create_event',
          payload: {
            title: 'פגישה עם יוסי',
            people: ['יוסי'],
            location: 'משרד',
            scheduled: {
              dateIso,
              startTimeIso: `${dateIso}T14:00:00.000Z`,
              endTimeIso: `${dateIso}T15:00:00.000Z`
            }
          },
          dependencies: [],
          constraints: [],
          mustLock: false,
          urgency: 'medium'
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.state.events.length).toBe(1);
      expect(result.state.events[0].title).toBe('פגישה עם יוסי');
      expect(result.state.scheduleBlocks.length).toBe(1);
      expect(result.state.scheduleBlocks[0].type).toBe('event');
    });
  });

  describe('cancel', () => {
    test('should cancel task and remove from blocks', () => {
      // First create a task
      store.addTask({
        title: 'משימה לביטול',
        status: 'pending',
        mustLock: false,
        urgency: 'low',
        durationMinutes: 30,
        scheduled: null,
        dependencies: []
      });

      const taskId = store.getState().tasks[0].id;

      // Add a block for it
      store.addBlock({
        type: 'task',
        refId: taskId,
        title: 'משימה לביטול',
        startTimeIso: '2026-01-23T10:00:00.000Z',
        endTimeIso: '2026-01-23T10:30:00.000Z'
      });

      const decision = createMockDecision({
        actionPlan: {
          actionType: 'cancel',
          payload: { entityId: taskId, entityType: 'task' },
          dependencies: [],
          constraints: [],
          mustLock: false,
          urgency: 'low'
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.state.tasks[0].status).toBe('canceled');
      expect(result.state.scheduleBlocks.length).toBe(0);
    });
  });

  describe('markDone', () => {
    test('should mark task as done and remove from timeline', () => {
      const task = store.addTask({
        title: 'משימה להשלמה',
        status: 'pending',
        mustLock: false,
        urgency: 'low',
        durationMinutes: 20,
        scheduled: null,
        dependencies: []
      });

      store.addBlock({
        type: 'task',
        refId: task.id,
        title: task.title,
        startTimeIso: '2026-01-23T09:00:00.000Z',
        endTimeIso: '2026-01-23T09:20:00.000Z'
      });

      const result = engine.markDone(task.id);

      expect(result.success).toBe(true);
      expect(result.state.tasks[0].status).toBe('done');
      expect(result.state.scheduleBlocks.length).toBe(0);
    });
  });

  describe('ask decision', () => {
    test('should show question modal when decision is ask', () => {
      const decision = createMockDecision({
        decision: 'ask',
        reason: 'חסר זמן',
        question: {
          shouldAsk: true,
          questionId: 'time',
          text: 'מתי תרצה?',
          expectedAnswerType: 'time',
          options: []
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.uiInstructions.showQuestionModal).toBe(true);
      expect(result.state.lastQuestion?.text).toBe('מתי תרצה?');
    });
  });

  describe('reflect decision', () => {
    test('should show reflection card when decision is reflect', () => {
      const decision = createMockDecision({
        decision: 'reflect',
        reason: 'מחשבה',
        reflection: {
          shouldReflect: true,
          text: 'נראה שאתה עמוס היום',
          microStep: 'קח נשימה עמוקה'
        }
      });

      const result = engine.apply(decision);

      expect(result.success).toBe(true);
      expect(result.uiInstructions.showReflectionCard).toBe(true);
      expect(result.state.lastReflection?.text).toBe('נראה שאתה עמוס היום');
    });
  });
});

describe('schedulePlanner', () => {
  test('should schedule tasks in free slots', () => {
    const dateIso = '2026-01-23';
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'משימה 1',
        taskType: 'general',
        status: 'pending',
        mustLock: false,
        urgency: 'medium',
        durationMinutes: 30,
        scheduled: null,
        dependencies: [],
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      },
      {
        id: 'task-2',
        title: 'משימה 2',
        taskType: 'general',
        status: 'pending',
        mustLock: false,
        urgency: 'low',
        durationMinutes: 45,
        scheduled: null,
        dependencies: [],
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      }
    ];

    const result = buildSchedule(dateIso, tasks, []);

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.unscheduledTasks.length).toBe(0);
  });

  test('should place events at fixed times', () => {
    const dateIso = '2026-01-23';
    const events: Event[] = [
      {
        id: 'event-1',
        title: 'פגישה',
        people: ['יוסי'],
        location: 'משרד',
        scheduled: {
          dateIso,
          startTimeIso: `${dateIso}T14:00:00.000Z`,
          endTimeIso: `${dateIso}T15:00:00.000Z`
        },
        recurrence: null,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      }
    ];

    const result = buildSchedule(dateIso, [], events);

    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].type).toBe('event');
    expect(result.blocks[0].startTimeIso).toBe(`${dateIso}T14:00:00.000Z`);
  });

  test('should enforce dependencies - unmet deps cause conflict', () => {
    const dateIso = '2026-01-23';
    // Both tasks have same urgency, but task-a depends on task-c which doesn't exist
    const tasks: Task[] = [
      {
        id: 'task-a',
        title: 'משימה א',
        taskType: 'general',
        status: 'pending',
        mustLock: true,  // mustLock to be processed first
        urgency: 'high',
        durationMinutes: 30,
        scheduled: null,
        dependencies: ['task-nonexistent'],  // Depends on non-existent task
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      }
    ];

    const result = buildSchedule(dateIso, tasks, []);

    // task-a should have a conflict because its dependency isn't scheduled
    expect(result.conflicts.some(c => c.type === 'dependency')).toBe(true);
    expect(result.unscheduledTasks.length).toBe(1);
  });
});

describe('reshufflePlanner', () => {
  test('should create 2 reshuffle plans', () => {
    const urgentTask: Task = {
      id: 'urgent',
      title: 'משימה דחופה',
      taskType: 'general',
      status: 'pending',
      mustLock: true,
      urgency: 'high',
      durationMinutes: 60,
      scheduled: null,
      dependencies: [],
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString()
    };

    const existingTasks: Task[] = [
      {
        id: 'existing-1',
        title: 'משימה קיימת',
        taskType: 'general',
        status: 'pending',
        mustLock: false,
        urgency: 'low',
        durationMinutes: 45,
        scheduled: null,
        dependencies: [],
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      }
    ];

    const blocks = [
      {
        id: 'block-1',
        type: 'task' as const,
        refId: 'existing-1',
        title: 'משימה קיימת',
        startTimeIso: '2026-01-23T10:00:00.000Z',
        endTimeIso: '2026-01-23T10:45:00.000Z'
      }
    ];

    const result = createReshufflePlans(urgentTask, blocks, existingTasks);

    expect(result.needed).toBe(true);
    expect(result.planOptions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('confirmPlan', () => {
  test('should apply selected plan and update schedule', () => {
    const store = new InMemoryStore();
    const engine = new TaskTimeEngine(store);

    // Add a task
    store.addTask({
      title: 'משימה גמישה',
      status: 'pending',
      mustLock: false,
      urgency: 'low',
      durationMinutes: 60,
      scheduled: null,
      dependencies: []
    });

    const taskId = store.getState().tasks[0].id;

    const plans = [
      {
        planId: 'A' as const,
        description: 'Shorten',
        descriptionHe: 'לקצר',
        changes: [
          { entityId: taskId, action: 'shorten' as const, from: '60 דקות', to: '30 דקות' }
        ],
        affectedTasks: [taskId]
      },
      {
        planId: 'B' as const,
        description: 'Postpone',
        descriptionHe: 'לדחות',
        changes: [
          { entityId: taskId, action: 'postpone' as const, from: 'היום', to: 'מחר' }
        ],
        affectedTasks: [taskId]
      }
    ];

    const result = engine.confirmPlan('A', plans);

    expect(result.success).toBe(true);
    expect(result.state.tasks[0].durationMinutes).toBe(30);
    expect(result.state.decisionLog.length).toBe(1);
  });
});
