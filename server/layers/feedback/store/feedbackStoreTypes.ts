// Layer 7: Feedback Store Types

import type { 
  FeedbackMessage, 
  CheckInRequest, 
  FeedbackStats,
  PlannedVsActualEntry,
  CompletionRateEntry,
  StressSignalEntry
} from '../types/feedbackTypes.js';

export interface FeedbackStoreState {
  feedbackFeed: FeedbackMessage[];
  lastDailyReviewIso: string | null;
  pendingCheckIn: CheckInRequest | null;
  stats: FeedbackStats;
  checkInCooldowns: Map<string, string>;
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
  
  reset(): void;
}

export const MAX_FEEDBACK_FEED_SIZE = 50;
