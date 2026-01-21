// Layer 3: Decision Engine
// Decides: execute, ask, reflect, or stop

import type { IntentAnalysis, DecisionResult, DecisionAction } from '../types';

export function makeDecision(analysis: IntentAnalysis): DecisionResult {
  const { primaryIntent, missingInfo, cognitiveLoad, confidenceScore, inputType, entities } = analysis;

  // Emotional dump -> reflect mode
  if (inputType === 'emotional_dump' || cognitiveLoad === 'high') {
    return {
      action: 'reflect',
      reason: 'זוהה עומס רגשי או קוגניטיבי גבוה'
    };
  }

  // Unknown intent -> ask for clarification
  if (primaryIntent === 'unknown') {
    return {
      action: 'ask',
      reason: 'לא הצלחתי להבין את הכוונה',
      followUpQuestions: ['מה בדיוק היית רוצה לעשות?']
    };
  }

  // Scheduling intents MUST have date or time
  const schedulingIntents = ['create_task', 'create_event', 'reschedule'];
  if (schedulingIntents.includes(primaryIntent)) {
    const hasTimeOrDate = entities.date || entities.time;
    
    if (!hasTimeOrDate) {
      return {
        action: 'ask',
        reason: 'חסר זמן או תאריך',
        followUpQuestions: ['מתי זה אמור להיות?']
      };
    }
    
    // Events need duration
    if (primaryIntent === 'create_event' && !entities.duration) {
      return {
        action: 'ask',
        reason: 'חסר משך זמן לאירוע',
        followUpQuestions: ['כמה זמן זה ייקח?']
      };
    }
  }

  // Missing critical info -> ask
  if (missingInfo.length > 0) {
    const questions = missingInfo.map(info => {
      switch (info) {
        case 'time_or_date': return 'מתי זה אמור להיות?';
        case 'task_name': return 'מה בדיוק המשימה?';
        case 'duration': return 'כמה זמן זה ייקח?';
        case 'new_time': return 'לאיזה זמן להזיז?';
        default: return `חסר מידע: ${info}`;
      }
    });
    
    return {
      action: 'ask',
      reason: 'חסר מידע קריטי',
      followUpQuestions: questions
    };
  }

  // Low confidence -> ask confirmation
  if (confidenceScore < 0.5) {
    return {
      action: 'ask',
      reason: 'רמת ביטחון נמוכה',
      followUpQuestions: ['האם הבנתי נכון?']
    };
  }

  // All good -> execute
  return {
    action: 'execute',
    reason: 'כל המידע זמין, אפשר לבצע'
  };
}

export class DecisionEngine {
  async process(analysis: IntentAnalysis): Promise<DecisionResult> {
    return makeDecision(analysis);
  }
}

// READY FOR NEXT LAYER: Task & Time Engine
