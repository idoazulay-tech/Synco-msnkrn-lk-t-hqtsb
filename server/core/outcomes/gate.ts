/**
 * Outcome Anchor Gate - שער חוק-על
 * 
 * enforceOutcomeAnchorLayer(scheduleState, proposedOperation)
 * 
 * חוסם פעולות שפוגעות בשרשרת המובילה ל-OutcomeAnchor
 * או שוברות תכנון לאחור
 */

import {
  OutcomeGateDecision,
  OutcomeOperation,
  OutcomeScheduleState,
  LinkedTask
} from './types';
import { TimeConstraintType } from '../timeConstraints/types';

export function enforceOutcomeAnchorLayer(
  scheduleState: OutcomeScheduleState,
  proposedOperation: OutcomeOperation
): OutcomeGateDecision {
  const { operationType, taskId, outcomeId, proposedStartTime, proposedEndTime, isAutomatic } = proposedOperation;
  
  switch (operationType) {
    case 'delete_task':
      return handleDeleteTask(scheduleState, taskId, isAutomatic);
    
    case 'move_task':
      return handleMoveTask(scheduleState, taskId, proposedStartTime, proposedEndTime, isAutomatic);
    
    case 'reschedule_outcome':
      return handleRescheduleOutcome(scheduleState, outcomeId, proposedStartTime, isAutomatic);
    
    case 'create_task':
      return handleCreateTask(scheduleState, proposedStartTime, proposedEndTime);
    
    case 'optimize':
      return handleOptimize(scheduleState, taskId, isAutomatic);
    
    default:
      return {
        allowed: true,
        reason: 'פעולה מותרת'
      };
  }
}

function handleDeleteTask(
  state: OutcomeScheduleState,
  taskId: string | undefined,
  isAutomatic: boolean
): OutcomeGateDecision {
  if (!taskId) {
    return { allowed: true, reason: 'אין משימה לבדיקה' };
  }
  
  const linkedTask = state.linkedTasks.find(t => t.id === taskId);
  
  if (!linkedTask) {
    return { allowed: true, reason: 'המשימה לא מקושרת לתוצאה' };
  }
  
  const outcome = state.outcomes.find(o => o.id === linkedTask.linkedOutcomeId);
  
  if (!outcome) {
    return { allowed: true, reason: 'לא נמצאה תוצאה מקושרת' };
  }
  
  if (isAutomatic) {
    return {
      allowed: false,
      reason: `אסור למחוק את "${linkedTask.title}" - משימה חיונית להגעה ל"${outcome.title}"`,
      affectedOutcomeId: outcome.id,
      chainBreakType: 'removes_linked'
    };
  }
  
  return {
    allowed: false,
    reason: `מחיקת "${linkedTask.title}" תפגע ביכולת להגיע ל"${outcome.title}" בזמן. נדרש אישור ידני.`,
    affectedOutcomeId: outcome.id,
    chainBreakType: 'removes_linked'
  };
}

function handleMoveTask(
  state: OutcomeScheduleState,
  taskId: string | undefined,
  proposedStart: Date | undefined,
  proposedEnd: Date | undefined,
  isAutomatic: boolean
): OutcomeGateDecision {
  if (!taskId) {
    return { allowed: true, reason: 'אין משימה לבדיקה' };
  }
  
  const linkedTask = state.linkedTasks.find(t => t.id === taskId);
  
  if (!linkedTask) {
    return { allowed: true, reason: 'המשימה לא מקושרת לתוצאה - מותר להזיז' };
  }
  
  const outcome = state.outcomes.find(o => o.id === linkedTask.linkedOutcomeId);
  
  if (!outcome) {
    return { allowed: true, reason: 'לא נמצאה תוצאה מקושרת' };
  }
  
  if (proposedEnd && proposedEnd > linkedTask.latestEnd) {
    return {
      allowed: false,
      reason: `הזזת "${linkedTask.title}" תגרום לאיחור בהגעה ל"${outcome.title}"`,
      affectedOutcomeId: outcome.id,
      chainBreakType: 'deadline_breach'
    };
  }
  
  if (isAutomatic && !linkedTask.isFlexible) {
    return {
      allowed: false,
      reason: `משימה "${linkedTask.title}" מקושרת לתוצאה - אסור להזיז אוטומטית`,
      affectedOutcomeId: outcome.id,
      chainBreakType: 'moves_linked'
    };
  }
  
  return {
    allowed: true,
    reason: 'הזזה מותרת בתוך חלון הזמן'
  };
}

function handleRescheduleOutcome(
  state: OutcomeScheduleState,
  outcomeId: string | undefined,
  proposedStart: Date | undefined,
  isAutomatic: boolean
): OutcomeGateDecision {
  if (!outcomeId) {
    return { allowed: true, reason: 'אין תוצאה לבדיקה' };
  }
  
  const outcome = state.outcomes.find(o => o.id === outcomeId);
  
  if (!outcome) {
    return { allowed: true, reason: 'לא נמצאה תוצאה' };
  }
  
  if (isAutomatic) {
    return {
      allowed: false,
      reason: `תוצאה "${outcome.title}" היא HARD_LOCK - אסור להזיז אוטומטית`,
      affectedOutcomeId: outcome.id,
      chainBreakType: 'moves_linked'
    };
  }
  
  return {
    allowed: true,
    reason: 'הזזה ידנית של תוצאה מותרת'
  };
}

function handleCreateTask(
  state: OutcomeScheduleState,
  proposedStart: Date | undefined,
  proposedEnd: Date | undefined
): OutcomeGateDecision {
  if (!proposedStart || !proposedEnd) {
    return { allowed: true, reason: 'אין זמנים לבדיקה' };
  }
  
  for (const outcome of state.outcomes) {
    const linkedTasks = state.linkedTasks.filter(
      t => t.linkedOutcomeId === outcome.id
    );
    
    for (const task of linkedTasks) {
      const taskInSchedule = state.allTasks.find(t => t.id === task.id);
      if (!taskInSchedule) continue;
      
      const hasOverlap = proposedStart < taskInSchedule.endTime && 
                         proposedEnd > taskInSchedule.startTime;
      
      if (hasOverlap) {
        return {
          allowed: false,
          reason: `המשימה החדשה מתנגשת עם "${task.title}" שמקושרת ל"${outcome.title}"`,
          affectedOutcomeId: outcome.id,
          chainBreakType: 'time_conflict'
        };
      }
    }
  }
  
  return { allowed: true, reason: 'אין התנגשות עם משימות מקושרות' };
}

function handleOptimize(
  state: OutcomeScheduleState,
  taskId: string | undefined,
  isAutomatic: boolean
): OutcomeGateDecision {
  if (!taskId) {
    return { allowed: true, reason: 'אין משימה ספציפית' };
  }
  
  const linkedTask = state.linkedTasks.find(t => t.id === taskId);
  
  if (linkedTask) {
    return {
      allowed: false,
      reason: `משימה "${linkedTask.title}" מקושרת לתוצאה - לא נכללת באופטימיזציה`,
      affectedOutcomeId: linkedTask.linkedOutcomeId,
      chainBreakType: 'moves_linked'
    };
  }
  
  return { allowed: true, reason: 'משימה לא מקושרת - ניתנת לאופטימיזציה' };
}

export function checkChainIntegrity(
  state: OutcomeScheduleState,
  outcomeId: string
): { isIntact: boolean; brokenLinks: string[]; reason: string } {
  const outcome = state.outcomes.find(o => o.id === outcomeId);
  
  if (!outcome) {
    return { isIntact: false, brokenLinks: [], reason: 'תוצאה לא נמצאה' };
  }
  
  const linkedTasks = state.linkedTasks
    .filter(t => t.linkedOutcomeId === outcomeId)
    .sort((a, b) => a.order - b.order);
  
  const brokenLinks: string[] = [];
  let previousEnd: Date | null = null;
  
  for (const task of linkedTasks) {
    const taskInSchedule = state.allTasks.find(t => t.id === task.id);
    
    if (!taskInSchedule) {
      brokenLinks.push(task.id);
      continue;
    }
    
    if (taskInSchedule.endTime > task.latestEnd) {
      brokenLinks.push(task.id);
    }
    
    if (previousEnd && taskInSchedule.startTime < previousEnd) {
      brokenLinks.push(task.id);
    }
    
    previousEnd = taskInSchedule.endTime;
  }
  
  return {
    isIntact: brokenLinks.length === 0,
    brokenLinks,
    reason: brokenLinks.length === 0 
      ? 'שרשרת שלמה' 
      : `${brokenLinks.length} משימות פוגעות בהגעה לתוצאה`
  };
}

export function canFillGapsBumpLinked(
  fillGapsTask: { id: string; title: string },
  linkedTask: LinkedTask
): boolean {
  return false;
}
