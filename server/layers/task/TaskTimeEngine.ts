// Layer 4: Task & Time Engine - Main Engine

import type { DecisionOutput, ActionPlan } from '../decision/types/decisionTypes.js';
import type { 
  Task, 
  Event, 
  ScheduleBlock, 
  CreateTaskPayload, 
  CreateEventPayload,
  ReschedulePayload,
  CancelPayload,
  LogNotePayload,
  TaskType
} from './types/taskTypes.js';
import { classifyTaskType } from './rules/taskTypeClassifier.js';
import type { 
  ScheduleResult, 
  ReshuffleResult,
  ScheduleConfig 
} from './types/scheduleTypes.js';
import type { UIInstructions, ProcessResult } from './store/storeTypes.js';
import { InMemoryStore, getStore } from './store/InMemoryStore.js';
import { buildSchedule } from './planners/schedulePlanner.js';
import { createReshufflePlans, applyReshufflePlan } from './planners/reshufflePlanner.js';
import { shouldBeMustLock, detectUrgency } from './rules/mustLockRules.js';
import { analyzeConflictSeverity, getConflictResolutionOptions } from './rules/conflictRules.js';
import { estimateTaskDuration } from './index.js';

const DEFAULT_CONFIG: ScheduleConfig = {
  dayStartHour: 8,
  dayEndHour: 22,
  bufferMinutes: 5,
  minTaskMinutes: 10
};

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function createDefaultUIInstructions(): UIInstructions {
  return {
    showQuestionModal: false,
    showReflectionCard: false,
    showPlanChoiceModal: false,
    refreshTimeline: false,
    refreshTaskList: false,
    planOptions: null,
    pendingPlanProposal: null,
    message: null,
    messageType: null
  };
}

export class TaskTimeEngine {
  private store: InMemoryStore;
  private config: ScheduleConfig;

  constructor(store?: InMemoryStore, config?: ScheduleConfig) {
    this.store = store || getStore();
    this.config = config || DEFAULT_CONFIG;
  }

  apply(decision: DecisionOutput): ProcessResult {
    const actionType = decision.actionPlan.actionType;
    const payload = decision.actionPlan.payload;
    
    let uiInstructions = createDefaultUIInstructions();

    switch (decision.decision) {
      case 'ask':
        this.store.setLastQuestion(decision.question);
        uiInstructions.showQuestionModal = true;
        return {
          success: true,
          state: this.store.getState(),
          uiInstructions
        };

      case 'reflect':
        this.store.setLastReflection(decision.reflection);
        uiInstructions.showReflectionCard = true;
        return {
          success: true,
          state: this.store.getState(),
          uiInstructions
        };

      case 'stop':
        uiInstructions.message = decision.reason;
        uiInstructions.messageType = 'warning';
        return {
          success: false,
          state: this.store.getState(),
          uiInstructions
        };

      case 'execute':
        return this.executeAction(actionType, payload, uiInstructions);

      default:
        return {
          success: false,
          state: this.store.getState(),
          uiInstructions: {
            ...uiInstructions,
            message: 'פעולה לא מוכרת',
            messageType: 'error'
          }
        };
    }
  }

  private executeAction(
    actionType: string,
    payload: Record<string, unknown>,
    uiInstructions: UIInstructions
  ): ProcessResult {
    switch (actionType) {
      case 'create_task':
        return this.createTask(payload as unknown as CreateTaskPayload, uiInstructions);

      case 'create_event':
        return this.createEvent(payload as unknown as CreateEventPayload, uiInstructions);

      case 'reschedule':
        return this.reschedule(payload as unknown as ReschedulePayload, uiInstructions);

      case 'cancel':
        return this.cancelEntity(payload as unknown as CancelPayload, uiInstructions);

      case 'inquire':
        uiInstructions.message = 'מה אתה רוצה לדעת?';
        uiInstructions.showQuestionModal = true;
        return {
          success: true,
          state: this.store.getState(),
          uiInstructions
        };

      case 'log_note':
        return this.logNote(payload as unknown as LogNotePayload, uiInstructions);

      default:
        return {
          success: true,
          state: this.store.getState(),
          uiInstructions: {
            ...uiInstructions,
            refreshTimeline: true,
            refreshTaskList: true
          }
        };
    }
  }

  private createTask(
    payload: CreateTaskPayload,
    uiInstructions: UIInstructions
  ): ProcessResult {
    const rawText = payload.title || '';
    
    const task = this.store.addTask({
      title: payload.title,
      taskType: classifyTaskType(rawText),
      status: 'pending',
      mustLock: payload.mustLock ?? shouldBeMustLock(rawText),
      urgency: payload.urgency ?? detectUrgency(rawText),
      durationMinutes: payload.durationMinutes ?? estimateTaskDuration(rawText, rawText),
      scheduled: payload.scheduled || null,
      dependencies: payload.dependencies || []
    });

    // Auto-schedule if urgency is high
    if (task.urgency === 'high' && !task.scheduled) {
      const result = this.scheduleForToday(task);
      if (!result.success && result.conflicts.length > 0) {
        // Need reshuffle
        const reshuffleResult = this.handleReshuffle(task);
        if (reshuffleResult.planOptions && reshuffleResult.planOptions.length > 0) {
          uiInstructions.planOptions = reshuffleResult.planOptions;
          uiInstructions.message = reshuffleResult.reason;
          uiInstructions.messageType = 'warning';
        }
      }
    }

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = `נוצרה משימה: ${task.title}`;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  private createEvent(
    payload: CreateEventPayload,
    uiInstructions: UIInstructions
  ): ProcessResult {
    const event = this.store.addEvent({
      title: payload.title,
      people: payload.people || [],
      location: payload.location || '',
      scheduled: payload.scheduled,
      recurrence: payload.recurrence || null
    });

    // Add to schedule
    this.store.addBlock({
      type: 'event',
      refId: event.id,
      title: event.title,
      startTimeIso: event.scheduled.startTimeIso,
      endTimeIso: event.scheduled.endTimeIso
    });

    uiInstructions.refreshTimeline = true;
    uiInstructions.message = `נוצר אירוע: ${event.title}`;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  private reschedule(
    payload: ReschedulePayload,
    uiInstructions: UIInstructions
  ): ProcessResult {
    if (payload.entityType === 'task') {
      const task = this.store.updateTask(payload.entityId, {
        scheduled: payload.newScheduled
      });
      
      if (!task) {
        uiInstructions.message = 'משימה לא נמצאה';
        uiInstructions.messageType = 'error';
        return { success: false, state: this.store.getState(), uiInstructions };
      }

      // Update block
      this.store.removeBlockByRef(payload.entityId);
      this.store.addBlock({
        type: 'task',
        refId: task.id,
        title: task.title,
        startTimeIso: payload.newScheduled.startTimeIso,
        endTimeIso: payload.newScheduled.endTimeIso
      });
    } else {
      const event = this.store.updateEvent(payload.entityId, {
        scheduled: payload.newScheduled
      });
      
      if (!event) {
        uiInstructions.message = 'אירוע לא נמצא';
        uiInstructions.messageType = 'error';
        return { success: false, state: this.store.getState(), uiInstructions };
      }

      // Update block
      this.store.removeBlockByRef(payload.entityId);
      this.store.addBlock({
        type: 'event',
        refId: event.id,
        title: event.title,
        startTimeIso: payload.newScheduled.startTimeIso,
        endTimeIso: payload.newScheduled.endTimeIso
      });
    }

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = 'הזמן עודכן בהצלחה';
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  private cancelEntity(
    payload: CancelPayload,
    uiInstructions: UIInstructions
  ): ProcessResult {
    if (payload.entityType === 'task') {
      const task = this.store.updateTask(payload.entityId, { status: 'canceled' });
      if (!task) {
        uiInstructions.message = 'משימה לא נמצאה';
        uiInstructions.messageType = 'error';
        return { success: false, state: this.store.getState(), uiInstructions };
      }
      this.store.removeBlockByRef(payload.entityId);
      uiInstructions.message = `בוטלה: ${task.title}`;
    } else {
      const deleted = this.store.deleteEvent(payload.entityId);
      if (!deleted) {
        uiInstructions.message = 'אירוע לא נמצא';
        uiInstructions.messageType = 'error';
        return { success: false, state: this.store.getState(), uiInstructions };
      }
      uiInstructions.message = 'אירוע בוטל';
    }

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  private logNote(
    payload: LogNotePayload,
    uiInstructions: UIInstructions
  ): ProcessResult {
    this.store.addNote({
      text: payload.text,
      tags: payload.tags || []
    });

    uiInstructions.message = 'הערה נשמרה';
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  private scheduleForToday(task: Task): ScheduleResult {
    const state = this.store.getState();
    const todayIso = getTodayIso();
    
    const result = buildSchedule(
      todayIso,
      [...state.tasks, task],
      state.events,
      this.config
    );

    if (result.success) {
      this.store.setBlocks(result.blocks);
    }

    return result;
  }

  private handleReshuffle(urgentTask: Task): ReshuffleResult {
    const state = this.store.getState();
    return createReshufflePlans(
      urgentTask,
      state.scheduleBlocks,
      state.tasks,
      this.config
    );
  }

  // Direct actions (from UI)
  markDone(taskId: string): ProcessResult {
    const task = this.store.updateTask(taskId, { status: 'done' });
    const uiInstructions = createDefaultUIInstructions();
    
    if (!task) {
      uiInstructions.message = 'משימה לא נמצאה';
      uiInstructions.messageType = 'error';
      return { success: false, state: this.store.getState(), uiInstructions };
    }

    this.store.removeBlockByRef(taskId);
    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = `הושלם: ${task.title}`;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  toggleMustLock(taskId: string): ProcessResult {
    const existing = this.store.getTask(taskId);
    const uiInstructions = createDefaultUIInstructions();
    
    if (!existing) {
      uiInstructions.message = 'משימה לא נמצאה';
      uiInstructions.messageType = 'error';
      return { success: false, state: this.store.getState(), uiInstructions };
    }

    this.store.updateTask(taskId, { mustLock: !existing.mustLock });
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = existing.mustLock ? 'משימה הפכה לגמישה' : 'משימה הפכה לקריטית';
    uiInstructions.messageType = 'info';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  updateDuration(taskId: string, newDuration: number): ProcessResult {
    const task = this.store.updateTask(taskId, { durationMinutes: newDuration });
    const uiInstructions = createDefaultUIInstructions();
    
    if (!task) {
      uiInstructions.message = 'משימה לא נמצאה';
      uiInstructions.messageType = 'error';
      return { success: false, state: this.store.getState(), uiInstructions };
    }

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = `משך הזמן עודכן ל-${newDuration} דקות`;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  moveToLater(taskId: string): ProcessResult {
    const task = this.store.getTask(taskId);
    const uiInstructions = createDefaultUIInstructions();
    
    if (!task) {
      uiInstructions.message = 'משימה לא נמצאה';
      uiInstructions.messageType = 'error';
      return { success: false, state: this.store.getState(), uiInstructions };
    }

    // Remove from current schedule
    this.store.removeBlockByRef(taskId);
    this.store.updateTask(taskId, { scheduled: null });

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.message = `משימה "${task.title}" נדחתה`;
    uiInstructions.messageType = 'info';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  confirmPlan(planId: 'A' | 'B', plans: ReshuffleResult['planOptions']): ProcessResult {
    const uiInstructions = createDefaultUIInstructions();
    const plan = plans?.find(p => p.planId === planId);
    
    if (!plan) {
      uiInstructions.message = 'תוכנית לא נמצאה';
      uiInstructions.messageType = 'error';
      return { success: false, state: this.store.getState(), uiInstructions };
    }

    const state = this.store.getState();
    const { updatedTasks, updatedBlocks } = applyReshufflePlan(
      plan,
      state.tasks,
      state.scheduleBlocks
    );

    // Update store
    for (const task of updatedTasks) {
      this.store.updateTask(task.id, task);
    }
    this.store.setBlocks(updatedBlocks);

    // Log decision
    this.store.addDecisionLog({
      decision: `selected_plan_${planId}`,
      selectedPlan: plan,
      reason: plan.descriptionHe
    });

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;
    uiInstructions.planOptions = null;
    uiInstructions.message = `יושמה תוכנית ${planId}`;
    uiInstructions.messageType = 'success';

    return {
      success: true,
      state: this.store.getState(),
      uiInstructions
    };
  }

  rebuildSchedule(dateIso?: string): ProcessResult {
    const uiInstructions = createDefaultUIInstructions();
    const state = this.store.getState();
    const targetDate = dateIso || getTodayIso();

    const pendingTasks = state.tasks.filter(t => t.status === 'pending');
    const result = buildSchedule(targetDate, pendingTasks, state.events, this.config);

    this.store.setBlocks(result.blocks);

    if (result.conflicts.length > 0) {
      const analysis = analyzeConflictSeverity(result.conflicts, state.tasks);
      if (analysis.suggestedAction === 'ask') {
        const options = getConflictResolutionOptions(result.conflicts, state.tasks);
        uiInstructions.message = analysis.questionText;
        uiInstructions.messageType = 'warning';
      }
    }

    uiInstructions.refreshTimeline = true;
    uiInstructions.refreshTaskList = true;

    return {
      success: result.success,
      state: this.store.getState(),
      uiInstructions
    };
  }
}

// READY FOR NEXT LAYER: Learning Engine
