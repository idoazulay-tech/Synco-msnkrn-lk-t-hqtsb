/**
 * Backward Planner - תכנון לאחור מתוצאה
 * 
 * עיקרון: כל תכנון מתחיל מהדדליין ומתכנן אחורה
 * לא מתכננים קדימה
 */

import { v4 as uuidv4 } from 'uuid';
import {
  OutcomeAnchor,
  LinkedTask,
  BackwardPlan,
  DEFAULT_ADHD_BUFFER_MINUTES
} from './types';
import { TimeConstraintType } from '../timeConstraints/types';

export interface TaskInput {
  title: string;
  durationMinutes: number;
  isFlexible?: boolean;
}

export function createOutcomeAnchor(
  title: string,
  deadlineTime: Date,
  options: {
    bufferMinutes?: number;
    originalText?: string;
    source?: 'detected' | 'manual';
  } = {}
): OutcomeAnchor {
  return {
    id: uuidv4(),
    title,
    deadlineTime,
    bufferMinutes: options.bufferMinutes ?? DEFAULT_ADHD_BUFFER_MINUTES,
    linkedTaskIds: [],
    timeConstraint: TimeConstraintType.HARD_LOCK,
    createdAt: new Date(),
    source: options.source ?? 'detected',
    originalText: options.originalText
  };
}

export function buildBackwardPlan(
  outcome: OutcomeAnchor,
  tasks: TaskInput[],
  currentTime: Date
): BackwardPlan {
  const linkedTasks: LinkedTask[] = [];
  let cursor = new Date(outcome.deadlineTime);
  
  cursor.setMinutes(cursor.getMinutes() - outcome.bufferMinutes);
  
  const reversedTasks = [...tasks].reverse();
  
  for (let i = 0; i < reversedTasks.length; i++) {
    const task = reversedTasks[i];
    const latestEnd = new Date(cursor);
    
    cursor.setMinutes(cursor.getMinutes() - task.durationMinutes);
    
    const linkedTask: LinkedTask = {
      id: uuidv4(),
      title: task.title,
      durationMinutes: task.durationMinutes,
      order: reversedTasks.length - i,
      linkedOutcomeId: outcome.id,
      latestEnd,
      isFlexible: task.isFlexible ?? false
    };
    
    linkedTasks.unshift(linkedTask);
  }
  
  const totalDurationMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const requiredStartTime = new Date(cursor);
  const hasEnoughTime = requiredStartTime >= currentTime;
  
  let shortfallMinutes: number | undefined;
  if (!hasEnoughTime) {
    shortfallMinutes = Math.ceil(
      (currentTime.getTime() - requiredStartTime.getTime()) / (1000 * 60)
    );
  }
  
  return {
    outcomeId: outcome.id,
    deadlineTime: outcome.deadlineTime,
    totalDurationMinutes: totalDurationMinutes + outcome.bufferMinutes,
    requiredStartTime,
    tasks: linkedTasks,
    hasEnoughTime,
    shortfallMinutes
  };
}

export function canAddTaskToPlan(
  plan: BackwardPlan,
  newTask: TaskInput,
  currentTime: Date
): { canAdd: boolean; newRequiredStart?: Date; reason: string } {
  const newRequiredStart = new Date(plan.requiredStartTime);
  newRequiredStart.setMinutes(newRequiredStart.getMinutes() - newTask.durationMinutes);
  
  if (newRequiredStart < currentTime) {
    const shortfall = Math.ceil(
      (currentTime.getTime() - newRequiredStart.getTime()) / (1000 * 60)
    );
    return {
      canAdd: false,
      reason: `אין מספיק זמן. חסרות ${shortfall} דקות`
    };
  }
  
  return {
    canAdd: true,
    newRequiredStart,
    reason: 'ניתן להוסיף את המשימה'
  };
}

export function getScheduleForLinkedTasks(
  plan: BackwardPlan
): Array<{ taskId: string; startTime: Date; endTime: Date }> {
  const schedule: Array<{ taskId: string; startTime: Date; endTime: Date }> = [];
  
  let cursor = new Date(plan.requiredStartTime);
  
  for (const task of plan.tasks) {
    const startTime = new Date(cursor);
    cursor.setMinutes(cursor.getMinutes() + task.durationMinutes);
    const endTime = new Date(cursor);
    
    schedule.push({
      taskId: task.id,
      startTime,
      endTime
    });
  }
  
  return schedule;
}

export function recalculatePlanWithCurrentTime(
  plan: BackwardPlan,
  currentTime: Date
): BackwardPlan {
  const hasEnoughTime = plan.requiredStartTime >= currentTime;
  
  let shortfallMinutes: number | undefined;
  if (!hasEnoughTime) {
    shortfallMinutes = Math.ceil(
      (currentTime.getTime() - plan.requiredStartTime.getTime()) / (1000 * 60)
    );
  }
  
  return {
    ...plan,
    hasEnoughTime,
    shortfallMinutes
  };
}
