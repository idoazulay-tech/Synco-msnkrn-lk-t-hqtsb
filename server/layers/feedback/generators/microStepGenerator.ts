// Layer 7: Micro-Step Generator - Small actionable steps for users

import type { FeedbackContext, StressLevel } from '../types/feedbackTypes.js';

export type MicroStepSituation = 
  | 'overload'
  | 'missing_info'
  | 'many_tasks'
  | 'procrastination'
  | 'no_must'
  | 'stuck'
  | 'after_cancel'
  | 'after_complete'
  | 'start_day'
  | 'end_day';

export interface MicroStepInput {
  situation: MicroStepSituation;
  taskCount?: number;
  mustLockCount?: number;
  missingField?: string;
  lastAction?: string;
}

export interface MicroStepResult {
  stepHebrew: string;
  estimatedMinutes: number;
  actionType: 'select' | 'start' | 'organize' | 'rest' | 'decide';
}

const MICRO_STEPS: Record<MicroStepSituation, MicroStepResult> = {
  overload: {
    stepHebrew: '5 דקות לסדר דבר אחד קטן',
    estimatedMinutes: 5,
    actionType: 'organize'
  },
  missing_info: {
    stepHebrew: 'בחר שעה אחת',
    estimatedMinutes: 1,
    actionType: 'decide'
  },
  many_tasks: {
    stepHebrew: 'סמן משימה אחת כ Must',
    estimatedMinutes: 1,
    actionType: 'select'
  },
  procrastination: {
    stepHebrew: 'פתח משימה אחת והתחל רק בשלב הראשון',
    estimatedMinutes: 5,
    actionType: 'start'
  },
  no_must: {
    stepHebrew: 'בחר את המשימה הכי חשובה להיום',
    estimatedMinutes: 2,
    actionType: 'select'
  },
  stuck: {
    stepHebrew: 'קח הפסקה של 5 דקות ותחזור',
    estimatedMinutes: 5,
    actionType: 'rest'
  },
  after_cancel: {
    stepHebrew: 'בחר משימה אחרת קטנה להתחיל',
    estimatedMinutes: 2,
    actionType: 'select'
  },
  after_complete: {
    stepHebrew: 'המשך למשימה הבאה',
    estimatedMinutes: 1,
    actionType: 'start'
  },
  start_day: {
    stepHebrew: 'בחר 3 משימות לביצוע היום',
    estimatedMinutes: 3,
    actionType: 'select'
  },
  end_day: {
    stepHebrew: 'סקור מה הושלם ומה נדחה',
    estimatedMinutes: 3,
    actionType: 'organize'
  }
};

export function generateMicroStep(input: MicroStepInput): MicroStepResult {
  return MICRO_STEPS[input.situation];
}

export function determineSituation(context: FeedbackContext, taskCount: number, mustLockCount: number): MicroStepSituation {
  if (context.currentStressLevel === 'high' || context.cognitiveLoad === 'high') {
    return 'overload';
  }
  
  if (taskCount > 10) {
    return 'many_tasks';
  }
  
  if (taskCount > 0 && mustLockCount === 0) {
    return 'no_must';
  }
  
  if (context.recentCancellations >= 2) {
    return 'procrastination';
  }
  
  return 'start_day';
}

export function getMicroStepForAction(action: string): MicroStepResult {
  switch (action) {
    case 'mark_done':
      return MICRO_STEPS.after_complete;
    case 'cancel':
      return MICRO_STEPS.after_cancel;
    default:
      return MICRO_STEPS.start_day;
  }
}

export function getMicroStepForMissingInfo(missingField: string): MicroStepResult {
  const customStep: MicroStepResult = {
    stepHebrew: `הוסף ${missingField}`,
    estimatedMinutes: 1,
    actionType: 'decide'
  };
  return customStep;
}
