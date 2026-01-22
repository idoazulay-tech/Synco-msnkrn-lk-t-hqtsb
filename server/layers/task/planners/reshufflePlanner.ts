// Layer 4: Task & Time Engine - Reshuffle Planner

import type { Task, ScheduleBlock } from '../types/taskTypes.js';
import type { ReshufflePlan, ReshuffleResult, ScheduleConfig } from '../types/scheduleTypes.js';

const DEFAULT_CONFIG: ScheduleConfig = {
  dayStartHour: 8,
  dayEndHour: 22,
  bufferMinutes: 5,
  minTaskMinutes: 10
};

function findNonMustLockTasks(
  blocks: ScheduleBlock[],
  tasks: Task[]
): { block: ScheduleBlock; task: Task }[] {
  const result: { block: ScheduleBlock; task: Task }[] = [];
  
  for (const block of blocks) {
    if (block.type !== 'task' || !block.refId) continue;
    
    const task = tasks.find(t => t.id === block.refId);
    if (task && !task.mustLock) {
      result.push({ block, task });
    }
  }
  
  return result;
}

function calculateShorteningPotential(
  blocks: ScheduleBlock[],
  tasks: Task[],
  config: ScheduleConfig
): { totalMinutes: number; changes: { taskId: string; reduction: number }[] } {
  const changes: { taskId: string; reduction: number }[] = [];
  let totalMinutes = 0;

  for (const block of blocks) {
    if (block.type !== 'task' || !block.refId) continue;
    
    const task = tasks.find(t => t.id === block.refId);
    if (!task || task.mustLock) continue;

    const currentDuration = task.durationMinutes;
    const minDuration = config.minTaskMinutes;
    const possibleReduction = Math.max(0, currentDuration - minDuration);
    
    if (possibleReduction > 0) {
      changes.push({ taskId: task.id, reduction: possibleReduction });
      totalMinutes += possibleReduction;
    }
  }

  return { totalMinutes, changes };
}

export function createReshufflePlans(
  urgentTask: Task,
  currentBlocks: ScheduleBlock[],
  allTasks: Task[],
  config: ScheduleConfig = DEFAULT_CONFIG
): ReshuffleResult {
  const neededMinutes = urgentTask.durationMinutes + config.bufferMinutes;
  const nonMustLock = findNonMustLockTasks(currentBlocks, allTasks);
  
  if (nonMustLock.length === 0) {
    return {
      needed: true,
      reason: 'אין משימות גמישות להזזה',
      planOptions: [],
      selectedPlan: null
    };
  }

  const plans: ReshufflePlan[] = [];

  // Plan A: Shorten non-must tasks
  const shorteningPotential = calculateShorteningPotential(currentBlocks, allTasks, config);
  
  if (shorteningPotential.totalMinutes >= neededMinutes) {
    const affectedTasks: string[] = [];
    let remainingNeeded = neededMinutes;
    const changes: ReshufflePlan['changes'] = [];

    for (const change of shorteningPotential.changes) {
      if (remainingNeeded <= 0) break;
      
      const reduction = Math.min(change.reduction, remainingNeeded);
      const task = allTasks.find(t => t.id === change.taskId);
      
      if (task) {
        changes.push({
          entityId: change.taskId,
          action: 'shorten',
          from: `${task.durationMinutes} דקות`,
          to: `${task.durationMinutes - reduction} דקות`
        });
        affectedTasks.push(change.taskId);
        remainingNeeded -= reduction;
      }
    }

    plans.push({
      planId: 'A',
      description: 'Shorten flexible tasks to make room',
      descriptionHe: 'לקצר משימות גמישות כדי לפנות מקום',
      changes,
      affectedTasks
    });
  }

  // Plan B: Postpone one non-must task
  const leastUrgentNonMust = nonMustLock.find(({ task }) => task.urgency === 'low') 
    || nonMustLock[nonMustLock.length - 1];
  
  if (leastUrgentNonMust) {
    plans.push({
      planId: 'B',
      description: 'Postpone one task to next available slot',
      descriptionHe: `לדחות את "${leastUrgentNonMust.task.title}" לחלון הזמן הבא`,
      changes: [{
        entityId: leastUrgentNonMust.task.id,
        action: 'postpone',
        from: 'היום',
        to: 'החלון הזמין הבא'
      }],
      affectedTasks: [leastUrgentNonMust.task.id]
    });
  }

  // Ensure we always have 2 options
  if (plans.length === 1) {
    // Add a cancel option if only one plan
    const toCancel = nonMustLock.find(({ task }) => 
      task.urgency === 'low' && task.id !== leastUrgentNonMust?.task.id
    );
    
    if (toCancel) {
      plans.push({
        planId: plans[0].planId === 'A' ? 'B' : 'A',
        description: 'Cancel a low-priority task',
        descriptionHe: `לבטל את "${toCancel.task.title}"`,
        changes: [{
          entityId: toCancel.task.id,
          action: 'cancel',
          from: 'פעיל',
          to: 'מבוטל'
        }],
        affectedTasks: [toCancel.task.id]
      });
    }
  }

  return {
    needed: true,
    reason: `משימה דחופה "${urgentTask.title}" צריכה מקום`,
    planOptions: plans,
    selectedPlan: null
  };
}

export function applyReshufflePlan(
  plan: ReshufflePlan,
  tasks: Task[],
  blocks: ScheduleBlock[]
): { updatedTasks: Task[]; updatedBlocks: ScheduleBlock[] } {
  const updatedTasks = [...tasks];
  const updatedBlocks = [...blocks];

  for (const change of plan.changes) {
    const taskIndex = updatedTasks.findIndex(t => t.id === change.entityId);
    if (taskIndex === -1) continue;

    switch (change.action) {
      case 'shorten': {
        const match = change.to.match(/(\d+)/);
        const newDuration = match ? parseInt(match[1], 10) : updatedTasks[taskIndex].durationMinutes;
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          durationMinutes: newDuration,
          updatedAtIso: new Date().toISOString()
        };
        break;
      }
      case 'postpone': {
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          scheduled: null,
          updatedAtIso: new Date().toISOString()
        };
        // Remove from blocks
        const blockIndex = updatedBlocks.findIndex(b => b.refId === change.entityId);
        if (blockIndex !== -1) {
          updatedBlocks.splice(blockIndex, 1);
        }
        break;
      }
      case 'cancel': {
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          status: 'canceled',
          updatedAtIso: new Date().toISOString()
        };
        // Remove from blocks
        const blockIndex = updatedBlocks.findIndex(b => b.refId === change.entityId);
        if (blockIndex !== -1) {
          updatedBlocks.splice(blockIndex, 1);
        }
        break;
      }
    }
  }

  return { updatedTasks, updatedBlocks };
}
