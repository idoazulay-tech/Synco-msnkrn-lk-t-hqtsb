// Layer 7: Success/Failure Analyzer for Automation Jobs

import type { 
  FeedbackMessage, 
  AutomationFeedbackInput,
  FeedbackContext,
  CheckInRequest
} from '../types/feedbackTypes.js';
import { shouldTriggerAutomationFeedback } from '../policies/triggers.js';
import { AUTOMATION_TEMPLATES, CHECKIN_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone } from '../policies/tonePolicy.js';

export interface AutomationAnalysisResult {
  feedbackMessage: FeedbackMessage | null;
  checkInRequest: CheckInRequest | null;
  shouldNotifyUser: boolean;
}

export function analyzeAutomationResult(
  input: AutomationFeedbackInput,
  context: FeedbackContext
): AutomationAnalysisResult {
  const triggerResult = shouldTriggerAutomationFeedback(input);
  
  if (!triggerResult.shouldTrigger) {
    return {
      feedbackMessage: null,
      checkInRequest: null,
      shouldNotifyUser: false
    };
  }
  
  const tone = determineTone(context);
  const title = input.entityTitle || input.actionType;
  
  let feedbackMessage: FeedbackMessage | null = null;
  let checkInRequest: CheckInRequest | null = null;
  
  switch (input.status) {
    case 'success':
      feedbackMessage = {
        id: `auto-success-${input.jobId}`,
        tsIso: new Date().toISOString(),
        type: 'post_action',
        tone,
        titleHebrew: 'סנכרון הושלם',
        bodyHebrew: applyTemplate(AUTOMATION_TEMPLATES.success, tone, { title }),
        microStepHebrew: '',
        related: {
          layer: 'automation',
          entityType: 'job',
          entityId: input.jobId
        },
        ui: {
          showAs: 'toast',
          priority: 'low'
        }
      };
      break;
    
    case 'failed':
      feedbackMessage = {
        id: `auto-failed-${input.jobId}`,
        tsIso: new Date().toISOString(),
        type: 'post_action',
        tone,
        titleHebrew: 'שגיאת סנכרון',
        bodyHebrew: applyTemplate(AUTOMATION_TEMPLATES.failed, tone, {}),
        microStepHebrew: 'נסה שוב מאוחר יותר',
        related: {
          layer: 'automation',
          entityType: 'job',
          entityId: input.jobId
        },
        ui: {
          showAs: 'card',
          priority: 'medium'
        }
      };
      
      checkInRequest = {
        id: `auto-retry-${input.jobId}`,
        tsIso: new Date().toISOString(),
        reason: 'automation_failed',
        questionHebrew: applyTemplate(CHECKIN_TEMPLATES.automationFailed, tone, {}),
        expectedAnswerType: 'choice',
        options: ['כן, נסה שוב', 'לא עכשיו'],
        relatedEntityId: input.jobId
      };
      break;
    
    case 'needs_user_action':
      feedbackMessage = {
        id: `auto-action-${input.jobId}`,
        tsIso: new Date().toISOString(),
        type: 'post_action',
        tone,
        titleHebrew: 'נדרשת פעולה',
        bodyHebrew: applyTemplate(AUTOMATION_TEMPLATES.needsUserAction, tone, {}),
        microStepHebrew: 'לחץ על Integrations להתחברות',
        related: {
          layer: 'automation',
          entityType: 'job',
          entityId: input.jobId
        },
        ui: {
          showAs: 'card',
          priority: 'high'
        }
      };
      break;
  }
  
  return {
    feedbackMessage,
    checkInRequest,
    shouldNotifyUser: true
  };
}

export function countRecentFailures(
  jobStatuses: Array<{ status: string; tsIso: string }>,
  hoursBack: number = 24
): number {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  return jobStatuses.filter(job => {
    const jobTime = new Date(job.tsIso);
    return jobTime >= cutoff && (job.status === 'failed' || job.status === 'needs_user_action');
  }).length;
}
