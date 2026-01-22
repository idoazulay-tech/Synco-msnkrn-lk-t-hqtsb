import type { IntentAnalysis } from '../../intent/types/intentTypes.js';
import type { DecisionOutput } from '../types/decisionTypes.js';
import { createDecisionOutput } from '../types/decisionTypes.js';
import { getQuestionTemplate } from '../policies/questionTemplates.js';

export function decideStop(analysis: IntentAnalysis): DecisionOutput {
  const template = getQuestionTemplate('clarifyIntent');
  
  return createDecisionOutput({
    decision: 'stop',
    reason: 'ביטחון נמוך מדי וחסרים פרטים קריטיים',
    confidence: analysis.confidenceScore,
    requiredNextLayer: 'none',
    question: {
      shouldAsk: true,
      questionId: template?.id ?? 'clarifyIntent',
      text: template?.text ?? 'לא הבנתי. אפשר להסביר שוב?',
      expectedAnswerType: template?.expectedAnswerType ?? 'choice',
      options: template?.options ?? ['משימה', 'פגישה', 'הערה']
    }
  });
}

export function shouldTriggerStop(analysis: IntentAnalysis): boolean {
  const { primaryIntent, missingInfo, confidenceScore } = analysis;
  
  const intentUnknown = primaryIntent === 'unknown' || !primaryIntent;
  const manyMissing = missingInfo.length >= 3;
  const veryLowConfidence = confidenceScore < 0.25;
  
  return intentUnknown && manyMissing && veryLowConfidence;
}
