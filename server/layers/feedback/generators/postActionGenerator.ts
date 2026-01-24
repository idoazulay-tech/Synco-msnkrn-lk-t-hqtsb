// Layer 7: Post-Action Feedback Generator

import type { 
  FeedbackMessage, 
  PostActionInput, 
  FeedbackContext
} from '../types/feedbackTypes.js';
import { shouldTriggerPostAction } from '../policies/triggers.js';
import { POST_ACTION_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone, adjustToneForContext } from '../policies/tonePolicy.js';

export interface PostActionResult {
  shouldShowFeedback: boolean;
  feedbackMessage: FeedbackMessage | null;
  updateStats: boolean;
}

export function generatePostActionFeedback(
  input: PostActionInput,
  context: FeedbackContext
): PostActionResult {
  const triggerResult = shouldTriggerPostAction(input);
  
  if (!triggerResult.shouldTrigger) {
    return {
      shouldShowFeedback: false,
      feedbackMessage: null,
      updateStats: false
    };
  }
  
  let baseTone = determineTone(context);
  let titleHebrew = '';
  let bodyHebrew = '';
  let microStepHebrew = '';
  let updateStats = false;
  
  switch (input.action) {
    case 'mark_done':
      const isLast = input.remainingCount === 0;
      baseTone = adjustToneForContext(baseTone, true);
      
      if (isLast) {
        titleHebrew = 'סיימת הכל!';
        bodyHebrew = applyTemplate(POST_ACTION_TEMPLATES.markDoneLast, baseTone, {});
        microStepHebrew = 'מגיע לך הפסקה';
      } else {
        titleHebrew = 'בוצע';
        bodyHebrew = applyTemplate(POST_ACTION_TEMPLATES.markDone, baseTone, {
          title: input.title,
          remaining: input.remainingCount || 0
        });
        microStepHebrew = 'המשך למשימה הבאה';
      }
      updateStats = true;
      break;
    
    case 'cancel':
      titleHebrew = 'בוטל';
      bodyHebrew = applyTemplate(POST_ACTION_TEMPLATES.cancel, baseTone, {
        title: input.title
      });
      microStepHebrew = 'תזמן מחדש או בחר משימה אחרת';
      break;
    
    case 'reschedule':
      titleHebrew = 'הועבר';
      bodyHebrew = applyTemplate(POST_ACTION_TEMPLATES.reschedule, baseTone, {
        title: input.title
      });
      break;
    
    case 'create':
      titleHebrew = 'נוצר';
      bodyHebrew = applyTemplate(POST_ACTION_TEMPLATES.create, baseTone, {
        title: input.title
      });
      break;
  }
  
  const feedbackMessage: FeedbackMessage = {
    id: `post-action-${input.entityId}-${Date.now()}`,
    tsIso: new Date().toISOString(),
    type: 'post_action',
    tone: baseTone,
    titleHebrew,
    bodyHebrew,
    microStepHebrew,
    related: {
      layer: 'task',
      entityType: input.entityType,
      entityId: input.entityId
    },
    ui: {
      showAs: 'toast',
      priority: triggerResult.priority
    }
  };
  
  return {
    shouldShowFeedback: true,
    feedbackMessage,
    updateStats
  };
}
