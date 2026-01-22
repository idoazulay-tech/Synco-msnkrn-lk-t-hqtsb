// Layer 3: Decision Engine - Modular Implementation
// Decides: execute, ask, reflect, or stop

export { DecisionEngine } from './DecisionEngine.js';
export type { MergedEntities } from './DecisionEngine.js';
export type { 
  DecisionOutput, 
  DecisionAction, 
  ActionType, 
  ActionPlan, 
  Question, 
  Reflection,
  Urgency,
  ExpectedAnswerType,
  NextLayer
} from './types/decisionTypes.js';
export { 
  createDecisionOutput, 
  createEmptyActionPlan, 
  createEmptyQuestion, 
  createEmptyReflection 
} from './types/decisionTypes.js';
export { THRESHOLDS } from './policies/thresholds.js';
export { INTENT_RULES, getIntentRule, getMostCriticalMissing } from './policies/rules.js';
export { QUESTION_TEMPLATES, getQuestionTemplate } from './policies/questionTemplates.js';
export { buildActionPlan } from './strategies/decideExecute.js';

// READY FOR NEXT LAYER: Task & Time Engine
