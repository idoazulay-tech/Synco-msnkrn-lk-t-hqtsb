// Layer 7: Reflection Generator

import type { 
  FeedbackMessage, 
  ReflectionInput, 
  FeedbackContext,
  ToneType
} from '../types/feedbackTypes.js';
import { shouldTriggerReflection } from '../policies/triggers.js';
import { REFLECTION_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone } from '../policies/tonePolicy.js';

export interface ReflectionResult {
  shouldShowReflection: boolean;
  feedbackMessage: FeedbackMessage | null;
}

export function generateReflection(
  input: ReflectionInput,
  context: FeedbackContext,
  microStep: string = ''
): ReflectionResult {
  const triggerResult = shouldTriggerReflection(input, context);
  
  if (!triggerResult.shouldTrigger) {
    return {
      shouldShowReflection: false,
      feedbackMessage: null
    };
  }
  
  const tone = determineTone(context);
  let titleHebrew = '';
  let bodyHebrew = '';
  let microStepHebrew = microStep;
  
  switch (input.decision) {
    case 'ask':
      titleHebrew = 'צריך עוד פרט';
      const missingInfo = input.missingInfo.length > 0 ? input.missingInfo[0] : 'פרט נוסף';
      const taskType = input.actionType === 'create_event' ? 'אירוע' : 'משימה';
      bodyHebrew = applyTemplate(REFLECTION_TEMPLATES.missingInfo, tone, {
        type: taskType,
        title: input.taskTitle || 'משימה',
        missing: missingInfo
      });
      break;
    
    case 'reflect':
      titleHebrew = 'נראה שיש עומס';
      bodyHebrew = applyTemplate(REFLECTION_TEMPLATES.reflect, tone, {});
      if (!microStepHebrew) {
        microStepHebrew = 'בחר משימה אחת קטנה להתחיל';
      }
      break;
    
    case 'stop':
      titleHebrew = 'לא הבנתי';
      bodyHebrew = applyTemplate(REFLECTION_TEMPLATES.stop, tone, {});
      microStepHebrew = 'נסה לנסח אחרת';
      break;
    
    case 'execute':
      if (input.confidence < 0.7) {
        titleHebrew = 'מתקדם';
        bodyHebrew = applyTemplate(REFLECTION_TEMPLATES.lowConfidence, tone, {
          understanding: input.taskTitle || 'הפעולה שביקשת'
        });
      }
      break;
  }
  
  if (!titleHebrew) {
    return {
      shouldShowReflection: false,
      feedbackMessage: null
    };
  }
  
  const feedbackMessage: FeedbackMessage = {
    id: `reflection-${Date.now()}`,
    tsIso: new Date().toISOString(),
    type: 'reflection',
    tone,
    titleHebrew,
    bodyHebrew,
    microStepHebrew,
    related: {
      layer: 'decision',
      entityType: 'none',
      entityId: null
    },
    ui: {
      showAs: input.decision === 'reflect' ? 'card' : 'toast',
      priority: triggerResult.priority
    }
  };
  
  return {
    shouldShowReflection: true,
    feedbackMessage
  };
}

export function generateQuickReflection(
  message: string,
  tone: ToneType = 'neutral'
): FeedbackMessage {
  return {
    id: `quick-reflection-${Date.now()}`,
    tsIso: new Date().toISOString(),
    type: 'reflection',
    tone,
    titleHebrew: 'שיקוף',
    bodyHebrew: message,
    microStepHebrew: '',
    related: {
      layer: 'intent',
      entityType: 'none',
      entityId: null
    },
    ui: {
      showAs: 'toast',
      priority: 'low'
    }
  };
}
