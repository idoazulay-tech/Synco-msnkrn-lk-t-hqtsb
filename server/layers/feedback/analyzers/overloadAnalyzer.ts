// Layer 7: Overload Analyzer - Stress and Cognitive Load Detection

import type { 
  FeedbackContext, 
  StressLevel,
  StressSignalEntry,
  CheckInRequest
} from '../types/feedbackTypes.js';
import { THRESHOLDS } from '../policies/thresholds.js';
import { shouldTriggerStressCheckIn } from '../policies/triggers.js';
import { CHECKIN_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone, determineStressLevel } from '../policies/tonePolicy.js';

export interface OverloadAnalysisResult {
  currentStressLevel: StressLevel;
  isOverloaded: boolean;
  shouldReduceLoad: boolean;
  checkInRequest: CheckInRequest | null;
  recommendedTone: 'neutral' | 'gentle' | 'direct';
}

export function analyzeOverload(
  cognitiveLoad: 'low' | 'medium' | 'high',
  recentCancellations: number,
  recentFailedJobs: number,
  existingContext?: Partial<FeedbackContext>
): OverloadAnalysisResult {
  const stressLevel = determineStressLevel(cognitiveLoad, recentCancellations, recentFailedJobs);
  const isOverloaded = stressLevel === 'high';
  const shouldReduceLoad = stressLevel !== 'low';
  
  const context: FeedbackContext = {
    cognitiveLoad,
    recentCancellations,
    recentFailedJobs,
    lastDailyReviewIso: existingContext?.lastDailyReviewIso || null,
    currentStressLevel: stressLevel
  };
  
  const triggerResult = shouldTriggerStressCheckIn(context);
  let checkInRequest: CheckInRequest | null = null;
  
  if (triggerResult.shouldTrigger) {
    const tone = determineTone(context);
    checkInRequest = {
      id: `stress-${Date.now()}`,
      tsIso: new Date().toISOString(),
      reason: 'stress_signal',
      questionHebrew: applyTemplate(CHECKIN_TEMPLATES.stressSignal, tone, {}),
      expectedAnswerType: 'choice',
      options: ['כן, להפחית', 'לא, הכל בסדר']
    };
  }
  
  const recommendedTone = isOverloaded ? 'gentle' : 'neutral';
  
  return {
    currentStressLevel: stressLevel,
    isOverloaded,
    shouldReduceLoad,
    checkInRequest,
    recommendedTone
  };
}

export function createStressSignalEntry(level: StressLevel): StressSignalEntry {
  return {
    dateIso: new Date().toISOString().split('T')[0],
    level
  };
}

export function getRecentStressAverage(entries: StressSignalEntry[], days: number = 7): StressLevel {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffIso = cutoffDate.toISOString().split('T')[0];
  
  const recentEntries = entries.filter(e => e.dateIso >= cutoffIso);
  
  if (recentEntries.length === 0) return 'low';
  
  const stressScores = recentEntries.map(e => {
    if (e.level === 'high') return 3;
    if (e.level === 'medium') return 2;
    return 1;
  });
  
  const avgScore = stressScores.reduce((a, b) => a + b, 0) / stressScores.length;
  
  if (avgScore >= 2.5) return 'high';
  if (avgScore >= 1.5) return 'medium';
  return 'low';
}

export function shouldBlockDailyReview(context: FeedbackContext): boolean {
  return context.currentStressLevel === 'high';
}

export function countRecentCancellations(
  actions: Array<{ action: string; tsIso: string }>,
  hoursBack: number = 24
): number {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  return actions.filter(a => {
    const actionTime = new Date(a.tsIso);
    return actionTime >= cutoff && a.action === 'cancel';
  }).length;
}
