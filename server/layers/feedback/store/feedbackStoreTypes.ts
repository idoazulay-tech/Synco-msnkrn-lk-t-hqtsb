// Layer 7: Feedback Store Types

import type { 
  FeedbackMessage, 
  CheckInRequest, 
  FeedbackStats,
  PlannedVsActualEntry,
  CompletionRateEntry,
  StressSignalEntry
} from '../types/feedbackTypes.js';

// PATCH 6: Feedback Cooldowns for No-Spam policy
export interface FeedbackCooldownEntry {
  lastShownIso: string;
}

export interface FeedbackStoreState {
  feedbackFeed: FeedbackMessage[];
  lastDailyReviewIso: string | null;
  pendingCheckIn: CheckInRequest | null;
  stats: FeedbackStats;
  checkInCooldowns: Map<string, string>;
  feedbackCooldowns: Map<string, FeedbackCooldownEntry>;
}

export interface IFeedbackStore {
  getState(): FeedbackStoreState;
  
  addFeedback(message: FeedbackMessage): void;
  getFeedbackFeed(limit?: number): FeedbackMessage[];
  clearFeedbackFeed(): void;
  
  setLastDailyReviewIso(isoDate: string): void;
  getLastDailyReviewIso(): string | null;
  
  setPendingCheckIn(checkIn: CheckInRequest | null): void;
  getPendingCheckIn(): CheckInRequest | null;
  
  addPlannedVsActual(entry: PlannedVsActualEntry): void;
  addCompletionRate(entry: CompletionRateEntry): void;
  addStressSignal(entry: StressSignalEntry): void;
  
  setCheckInCooldown(reason: string, untilIso: string): void;
  isCheckInOnCooldown(reason: string): boolean;
  
  // PATCH 6: Feedback cooldowns
  setFeedbackCooldown(key: string): void;
  isFeedbackOnCooldown(key: string, cooldownHours: number): boolean;
  buildFeedbackCooldownKey(type: string, entityType: string, entityId: string | null, reason?: string): string;
  
  reset(): void;
}

export const MAX_FEEDBACK_FEED_SIZE = 50;
