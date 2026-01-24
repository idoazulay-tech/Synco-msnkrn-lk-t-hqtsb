// Layer 7: Tone Policy for Feedback Messages

import type { ToneType, FeedbackContext, StressLevel } from '../types/feedbackTypes.js';

export interface ToneConfig {
  defaultTone: ToneType;
  overloadTone: ToneType;
  achievementTone: ToneType;
}

export const TONE_CONFIG: ToneConfig = {
  defaultTone: 'neutral',
  overloadTone: 'gentle',
  achievementTone: 'neutral'
};

export function determineTone(context: FeedbackContext): ToneType {
  if (context.currentStressLevel === 'high' || context.cognitiveLoad === 'high') {
    return TONE_CONFIG.overloadTone;
  }
  
  return TONE_CONFIG.defaultTone;
}

export function determineStressLevel(
  cognitiveLoad: 'low' | 'medium' | 'high',
  recentCancellations: number,
  recentFailedJobs: number
): StressLevel {
  let stressScore = 0;
  
  if (cognitiveLoad === 'high') stressScore += 2;
  else if (cognitiveLoad === 'medium') stressScore += 1;
  
  if (recentCancellations >= 3) stressScore += 2;
  else if (recentCancellations >= 1) stressScore += 1;
  
  if (recentFailedJobs >= 2) stressScore += 2;
  else if (recentFailedJobs >= 1) stressScore += 1;
  
  if (stressScore >= 4) return 'high';
  if (stressScore >= 2) return 'medium';
  return 'low';
}

export function adjustToneForContext(baseTone: ToneType, isPositiveFeedback: boolean): ToneType {
  if (isPositiveFeedback && baseTone === 'neutral') {
    return 'gentle';
  }
  return baseTone;
}
