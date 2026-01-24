// Context state initialization and management

import type { SessionState, ConversationTurn } from '../types';

export function createInitialState(): SessionState {
  return {
    turnId: generateTurnId(),
    lastIntent: null,
    lastEntities: null,
    lastMissingInfo: [],
    lastUserChoice: null,
    lastTurnId: null,
    rollingCognitiveLoad: [],
    conversationHistory: [],
    lastQuestionContext: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createConversationTurn(
  input: string
): ConversationTurn {
  return {
    turnId: generateTurnId(),
    timestamp: new Date(),
    input,
    analysis: null,
    userChoice: null
  };
}
