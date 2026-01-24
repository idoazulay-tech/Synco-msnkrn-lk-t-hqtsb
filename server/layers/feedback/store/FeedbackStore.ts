// Layer 7: Feedback Store - In-Memory Storage

import type { 
  IFeedbackStore, 
  FeedbackStoreState,
  MAX_FEEDBACK_FEED_SIZE 
} from './feedbackStoreTypes.js';
import type { 
  FeedbackMessage, 
  CheckInRequest,
  PlannedVsActualEntry,
  CompletionRateEntry,
  StressSignalEntry,
  FeedbackStats
} from '../types/feedbackTypes.js';

const MAX_FEED_SIZE = 50;
const MAX_STATS_ENTRIES = 30;

function createInitialState(): FeedbackStoreState {
  return {
    feedbackFeed: [],
    lastDailyReviewIso: null,
    pendingCheckIn: null,
    stats: {
      plannedVsActual: [],
      completionRateByDay: [],
      stressSignalsByDay: []
    },
    checkInCooldowns: new Map(),
    feedbackCooldowns: new Map()
  };
}

class FeedbackStore implements IFeedbackStore {
  private state: FeedbackStoreState;
  
  constructor() {
    this.state = createInitialState();
  }
  
  getState(): FeedbackStoreState {
    return {
      ...this.state,
      checkInCooldowns: new Map(this.state.checkInCooldowns),
      feedbackCooldowns: new Map(this.state.feedbackCooldowns)
    };
  }
  
  addFeedback(message: FeedbackMessage): void {
    this.state.feedbackFeed.unshift(message);
    
    if (this.state.feedbackFeed.length > MAX_FEED_SIZE) {
      this.state.feedbackFeed = this.state.feedbackFeed.slice(0, MAX_FEED_SIZE);
    }
  }
  
  getFeedbackFeed(limit: number = 20): FeedbackMessage[] {
    return this.state.feedbackFeed.slice(0, limit);
  }
  
  clearFeedbackFeed(): void {
    this.state.feedbackFeed = [];
  }
  
  setLastDailyReviewIso(isoDate: string): void {
    this.state.lastDailyReviewIso = isoDate;
  }
  
  getLastDailyReviewIso(): string | null {
    return this.state.lastDailyReviewIso;
  }
  
  setPendingCheckIn(checkIn: CheckInRequest | null): void {
    this.state.pendingCheckIn = checkIn;
  }
  
  getPendingCheckIn(): CheckInRequest | null {
    return this.state.pendingCheckIn;
  }
  
  addPlannedVsActual(entry: PlannedVsActualEntry): void {
    this.state.stats.plannedVsActual.push(entry);
    
    if (this.state.stats.plannedVsActual.length > MAX_STATS_ENTRIES) {
      this.state.stats.plannedVsActual = this.state.stats.plannedVsActual.slice(-MAX_STATS_ENTRIES);
    }
  }
  
  addCompletionRate(entry: CompletionRateEntry): void {
    const existingIndex = this.state.stats.completionRateByDay.findIndex(
      e => e.dateIso === entry.dateIso
    );
    
    if (existingIndex >= 0) {
      this.state.stats.completionRateByDay[existingIndex] = entry;
    } else {
      this.state.stats.completionRateByDay.push(entry);
    }
    
    if (this.state.stats.completionRateByDay.length > MAX_STATS_ENTRIES) {
      this.state.stats.completionRateByDay = this.state.stats.completionRateByDay.slice(-MAX_STATS_ENTRIES);
    }
  }
  
  addStressSignal(entry: StressSignalEntry): void {
    const existingIndex = this.state.stats.stressSignalsByDay.findIndex(
      e => e.dateIso === entry.dateIso
    );
    
    if (existingIndex >= 0) {
      this.state.stats.stressSignalsByDay[existingIndex] = entry;
    } else {
      this.state.stats.stressSignalsByDay.push(entry);
    }
    
    if (this.state.stats.stressSignalsByDay.length > MAX_STATS_ENTRIES) {
      this.state.stats.stressSignalsByDay = this.state.stats.stressSignalsByDay.slice(-MAX_STATS_ENTRIES);
    }
  }
  
  setCheckInCooldown(reason: string, untilIso: string): void {
    this.state.checkInCooldowns.set(reason, untilIso);
  }
  
  isCheckInOnCooldown(reason: string): boolean {
    const cooldownUntil = this.state.checkInCooldowns.get(reason);
    if (!cooldownUntil) return false;
    
    return new Date(cooldownUntil) > new Date();
  }
  
  // PATCH 6: Feedback cooldowns
  setFeedbackCooldown(key: string): void {
    this.state.feedbackCooldowns.set(key, {
      lastShownIso: new Date().toISOString()
    });
  }
  
  isFeedbackOnCooldown(key: string, cooldownHours: number = 6): boolean {
    const entry = this.state.feedbackCooldowns.get(key);
    if (!entry) return false;
    
    const lastShown = new Date(entry.lastShownIso);
    const cooldownEnd = new Date(lastShown.getTime() + cooldownHours * 60 * 60 * 1000);
    
    return new Date() < cooldownEnd;
  }
  
  buildFeedbackCooldownKey(type: string, entityType: string, entityId: string | null, reason?: string): string {
    const parts = [type, entityType];
    if (entityId) parts.push(entityId);
    if (reason) parts.push(reason);
    return parts.join(':');
  }
  
  reset(): void {
    this.state = createInitialState();
  }
}

let feedbackStoreInstance: FeedbackStore | null = null;

export function getFeedbackStore(): IFeedbackStore {
  if (!feedbackStoreInstance) {
    feedbackStoreInstance = new FeedbackStore();
  }
  return feedbackStoreInstance;
}

export function resetFeedbackStore(): void {
  if (feedbackStoreInstance) {
    feedbackStoreInstance.reset();
  }
}
