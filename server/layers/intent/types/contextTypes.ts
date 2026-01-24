// Context and session state type definitions

import type { IntentAnalysis, PrimaryIntent, ExtractedEntities } from './intentTypes';

// PATCH 1: lastQuestionContext for follow-up answer parsing
export type ExpectedAnswerType = 'choice' | 'free_text' | 'time' | 'date' | 'duration' | 'confirm' | 'plan_choice';
export type TargetField = 'date' | 'time' | 'duration' | 'scope' | 'targetCancel' | 'clarifyIntent' | 'plan_choice' | 'unknown';

export interface LastQuestionContext {
  questionId: string;
  expectedAnswerType: ExpectedAnswerType;
  targetField: TargetField;
  relatedEntityType: 'task' | 'event' | 'none';
  relatedEntityId: string | null;
  askedAtIso: string;
  options?: string[];
}

export interface SessionState {
  turnId: string;
  lastIntent: PrimaryIntent | null;
  lastEntities: Partial<ExtractedEntities> | null;
  lastMissingInfo: string[];
  lastUserChoice: string | null;
  lastTurnId: string | null;
  rollingCognitiveLoad: number[];
  conversationHistory: ConversationTurn[];
  lastQuestionContext: LastQuestionContext | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationTurn {
  turnId: string;
  timestamp: Date;
  input: string;
  analysis: IntentAnalysis | null;
  userChoice: string | null;
}

export interface ContextSuggestion {
  isFollowUp: boolean;
  isCompletingMissingInfo: boolean;
  suggestedEntity: string | null;
  refersToPreviousTurn: boolean;
}

export interface ContextManagerConfig {
  maxHistoryLength: number;
  cognitiveLoadWindow: number;
}
