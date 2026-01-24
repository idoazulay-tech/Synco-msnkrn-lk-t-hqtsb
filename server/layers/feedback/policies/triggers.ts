// Layer 7: Trigger Policies for Feedback Generation

import { THRESHOLDS } from './thresholds.js';
import type { FeedbackContext, ReflectionInput, PostActionInput, AutomationFeedbackInput } from '../types/feedbackTypes.js';

export interface TriggerResult {
  shouldTrigger: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export function shouldTriggerReflection(input: ReflectionInput, context: FeedbackContext): TriggerResult {
  if (input.decision === 'ask') {
    return {
      shouldTrigger: true,
      reason: 'decision_ask',
      priority: 'medium'
    };
  }
  
  if (input.decision === 'reflect') {
    return {
      shouldTrigger: true,
      reason: 'decision_reflect',
      priority: 'high'
    };
  }
  
  if (input.decision === 'stop') {
    return {
      shouldTrigger: true,
      reason: 'decision_stop',
      priority: 'medium'
    };
  }
  
  if (input.decision === 'execute' && input.confidence < THRESHOLDS.confidence.lowConfidenceWarning) {
    return {
      shouldTrigger: true,
      reason: 'low_confidence',
      priority: 'low'
    };
  }
  
  return {
    shouldTrigger: false,
    reason: 'no_trigger',
    priority: 'low'
  };
}

export function shouldTriggerPostAction(input: PostActionInput): TriggerResult {
  switch (input.action) {
    case 'mark_done':
      return {
        shouldTrigger: true,
        reason: 'task_completed',
        priority: 'low'
      };
    
    case 'cancel':
      return {
        shouldTrigger: true,
        reason: 'task_cancelled',
        priority: 'medium'
      };
    
    case 'reschedule':
      return {
        shouldTrigger: true,
        reason: 'task_rescheduled',
        priority: 'low'
      };
    
    case 'create':
      return {
        shouldTrigger: true,
        reason: 'entity_created',
        priority: 'low'
      };
    
    default:
      return {
        shouldTrigger: false,
        reason: 'unknown_action',
        priority: 'low'
      };
  }
}

export function shouldTriggerGapCheckIn(
  plannedMinutes: number, 
  actualMinutes: number,
  context: FeedbackContext
): TriggerResult {
  if (context.currentStressLevel === 'high') {
    return {
      shouldTrigger: false,
      reason: 'stress_too_high',
      priority: 'low'
    };
  }
  
  const gapPercent = Math.abs((actualMinutes - plannedMinutes) / plannedMinutes) * 100;
  
  if (gapPercent >= THRESHOLDS.gap.durationMismatchPercent) {
    return {
      shouldTrigger: true,
      reason: 'duration_gap',
      priority: 'medium'
    };
  }
  
  return {
    shouldTrigger: false,
    reason: 'gap_within_threshold',
    priority: 'low'
  };
}

export function shouldTriggerAutomationFeedback(input: AutomationFeedbackInput): TriggerResult {
  switch (input.status) {
    case 'success':
      return {
        shouldTrigger: true,
        reason: 'automation_success',
        priority: 'low'
      };
    
    case 'failed':
      return {
        shouldTrigger: true,
        reason: 'automation_failed',
        priority: 'medium'
      };
    
    case 'needs_user_action':
      return {
        shouldTrigger: true,
        reason: 'automation_needs_action',
        priority: 'high'
      };
    
    default:
      return {
        shouldTrigger: false,
        reason: 'unknown_status',
        priority: 'low'
      };
  }
}

export function shouldTriggerDailyReview(context: FeedbackContext): TriggerResult {
  if (context.currentStressLevel === 'high') {
    return {
      shouldTrigger: false,
      reason: 'stress_too_high',
      priority: 'low'
    };
  }
  
  if (!context.lastDailyReviewIso) {
    return {
      shouldTrigger: true,
      reason: 'no_previous_review',
      priority: 'medium'
    };
  }
  
  const lastReview = new Date(context.lastDailyReviewIso);
  const now = new Date();
  const hoursSinceLastReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastReview >= THRESHOLDS.dailyReview.minHoursSinceLastReview) {
    return {
      shouldTrigger: true,
      reason: 'time_for_review',
      priority: 'medium'
    };
  }
  
  return {
    shouldTrigger: false,
    reason: 'too_soon_for_review',
    priority: 'low'
  };
}

export function shouldTriggerStressCheckIn(context: FeedbackContext): TriggerResult {
  const stressIndicators = [
    context.recentCancellations >= THRESHOLDS.stress.highCancellationCount,
    context.recentFailedJobs >= THRESHOLDS.stress.highFailedJobsCount,
    context.cognitiveLoad === 'high'
  ].filter(Boolean).length;
  
  if (stressIndicators >= 2) {
    return {
      shouldTrigger: true,
      reason: 'multiple_stress_signals',
      priority: 'high'
    };
  }
  
  return {
    shouldTrigger: false,
    reason: 'stress_within_normal',
    priority: 'low'
  };
}
