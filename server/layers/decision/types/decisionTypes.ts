export type DecisionAction = 'execute' | 'ask' | 'reflect' | 'stop';
export type ActionType = 'create_task' | 'create_event' | 'reschedule' | 'cancel' | 'inquire' | 'log_note' | 'none';
export type Urgency = 'low' | 'medium' | 'high';
export type ExpectedAnswerType = 'choice' | 'free_text' | 'time' | 'date' | 'duration' | 'confirm';
export type NextLayer = 'task' | 'learning' | 'feedback' | 'none';

export interface ActionPlan {
  actionType: ActionType;
  payload: Record<string, unknown>;
  dependencies: string[];
  constraints: string[];
  mustLock: boolean;
  urgency: Urgency;
}

export interface Question {
  shouldAsk: boolean;
  questionId: string;
  text: string;
  expectedAnswerType: ExpectedAnswerType;
  options: string[];
}

export interface Reflection {
  shouldReflect: boolean;
  text: string;
  microStep: string;
}

export interface DecisionOutput {
  decision: DecisionAction;
  reason: string;
  confidence: number;
  requiredNextLayer: NextLayer;
  actionPlan: ActionPlan;
  question: Question;
  reflection: Reflection;
}

export function createEmptyActionPlan(): ActionPlan {
  return {
    actionType: 'none',
    payload: {},
    dependencies: [],
    constraints: [],
    mustLock: false,
    urgency: 'low'
  };
}

export function createEmptyQuestion(): Question {
  return {
    shouldAsk: false,
    questionId: '',
    text: '',
    expectedAnswerType: 'free_text',
    options: []
  };
}

export function createEmptyReflection(): Reflection {
  return {
    shouldReflect: false,
    text: '',
    microStep: ''
  };
}

export function createDecisionOutput(partial: Partial<DecisionOutput> = {}): DecisionOutput {
  return {
    decision: partial.decision ?? 'stop',
    reason: partial.reason ?? '',
    confidence: partial.confidence ?? 0,
    requiredNextLayer: partial.requiredNextLayer ?? 'none',
    actionPlan: partial.actionPlan ?? createEmptyActionPlan(),
    question: partial.question ?? createEmptyQuestion(),
    reflection: partial.reflection ?? createEmptyReflection()
  };
}
