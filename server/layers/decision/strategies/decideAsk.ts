import type { IntentAnalysis } from '../../intent/types/intentTypes.js';
import type { DecisionOutput, Question } from '../types/decisionTypes.js';
import { createDecisionOutput, createEmptyQuestion } from '../types/decisionTypes.js';
import { getMostCriticalMissing, type MissingField } from '../policies/rules.js';
import { getQuestionTemplate, type QuestionTemplate } from '../policies/questionTemplates.js';

function buildQuestion(field: MissingField): Question {
  const template = getQuestionTemplate(field);
  if (!template) {
    return {
      ...createEmptyQuestion(),
      shouldAsk: true,
      questionId: field,
      text: `מה הוא ${field}?`,
      expectedAnswerType: 'free_text'
    };
  }
  
  return {
    shouldAsk: true,
    questionId: template.id,
    text: template.text,
    expectedAnswerType: template.expectedAnswerType,
    options: template.options
  };
}

function mapMissingInfoToField(missingInfo: string[]): MissingField | null {
  const mapping: Record<string, MissingField> = {
    'date': 'date',
    'time': 'time',
    'taskName': 'taskName',
    'task_name': 'taskName',
    'scope': 'scope',
    'target': 'target',
    'duration': 'duration',
    'people': 'people'
  };
  
  for (const info of missingInfo) {
    if (mapping[info]) {
      return mapping[info];
    }
  }
  return null;
}

export function decideAsk(analysis: IntentAnalysis): DecisionOutput {
  const { primaryIntent, missingInfo } = analysis;
  
  let fieldToAsk = getMostCriticalMissing(primaryIntent, missingInfo);
  
  if (!fieldToAsk) {
    fieldToAsk = mapMissingInfoToField(missingInfo);
  }
  
  if (!fieldToAsk) {
    fieldToAsk = 'clarifyIntent';
  }
  
  const question = buildQuestion(fieldToAsk);
  
  return createDecisionOutput({
    decision: 'ask',
    reason: `חסר ${fieldToAsk} להשלמת ${primaryIntent}`,
    confidence: analysis.confidenceScore,
    requiredNextLayer: 'none',
    question
  });
}

export function decideAskWithSpecificField(
  analysis: IntentAnalysis, 
  field: MissingField
): DecisionOutput {
  const question = buildQuestion(field);
  
  return createDecisionOutput({
    decision: 'ask',
    reason: `שאלה על ${field}`,
    confidence: analysis.confidenceScore,
    requiredNextLayer: 'none',
    question
  });
}
