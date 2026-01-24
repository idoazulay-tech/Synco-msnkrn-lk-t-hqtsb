// Layer 7: Thresholds for Feedback Triggers

export const THRESHOLDS = {
  confidence: {
    lowConfidenceWarning: 0.7,
    veryLowConfidence: 0.5
  },
  
  gap: {
    durationMismatchPercent: 30,
    significantGapMinutes: 15
  },
  
  stress: {
    highCancellationCount: 3,
    highFailedJobsCount: 2,
    highCognitiveLoadCount: 3
  },
  
  dailyReview: {
    minHoursSinceLastReview: 20,
    maxHoursSinceLastReview: 28
  },
  
  cooldown: {
    checkInCooldownHours: 24,
    sameFeedbackCooldownMinutes: 30
  },
  
  feed: {
    maxFeedbackMessages: 20,
    maxDailyReviewsPerDay: 1
  }
};

export function isOverThreshold(value: number, threshold: number): boolean {
  return value > threshold;
}

export function calculateGapPercent(planned: number, actual: number): number {
  if (planned === 0) return 0;
  return Math.abs((actual - planned) / planned) * 100;
}

export function isGapSignificant(planned: number, actual: number): boolean {
  const gapPercent = calculateGapPercent(planned, actual);
  return gapPercent >= THRESHOLDS.gap.durationMismatchPercent;
}

export function getGapDirection(planned: number, actual: number): 'high' | 'low' | 'accurate' {
  const diff = actual - planned;
  if (Math.abs(diff) < THRESHOLDS.gap.significantGapMinutes) return 'accurate';
  return diff > 0 ? 'גבוהה' as unknown as 'high' : 'נמוכה' as unknown as 'low';
}
