// Layer 7: Gap Analyzer - Planned vs Actual Analysis

import type { 
  CheckInRequest, 
  FeedbackContext,
  PlannedVsActualEntry
} from '../types/feedbackTypes.js';
import { THRESHOLDS, calculateGapPercent, isGapSignificant } from '../policies/thresholds.js';
import { shouldTriggerGapCheckIn } from '../policies/triggers.js';
import { CHECKIN_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone } from '../policies/tonePolicy.js';

export interface GapAnalysisResult {
  hasSignificantGap: boolean;
  gapPercent: number;
  gapDirection: 'over' | 'under' | 'none';
  plannedMinutes: number;
  actualMinutes: number;
  checkInRequest: CheckInRequest | null;
}

export function analyzeGap(
  plannedMinutes: number,
  actualMinutes: number,
  entityId: string,
  context: FeedbackContext
): GapAnalysisResult {
  const gapPercent = calculateGapPercent(plannedMinutes, actualMinutes);
  const hasSignificantGap = isGapSignificant(plannedMinutes, actualMinutes);
  
  let gapDirection: 'over' | 'under' | 'none' = 'none';
  if (hasSignificantGap) {
    gapDirection = actualMinutes > plannedMinutes ? 'over' : 'under';
  }
  
  const triggerResult = shouldTriggerGapCheckIn(plannedMinutes, actualMinutes, context);
  
  let checkInRequest: CheckInRequest | null = null;
  
  if (triggerResult.shouldTrigger) {
    const tone = determineTone(context);
    const direction = gapDirection === 'over' ? 'גבוהה' : 'נמוכה';
    
    checkInRequest = {
      id: `gap-${entityId}-${Date.now()}`,
      tsIso: new Date().toISOString(),
      reason: 'duration_mismatch',
      questionHebrew: applyTemplate(CHECKIN_TEMPLATES.durationMismatch, tone, { direction }),
      expectedAnswerType: 'choice',
      options: ['כן', 'לא עכשיו'],
      relatedEntityId: entityId
    };
  }
  
  return {
    hasSignificantGap,
    gapPercent,
    gapDirection,
    plannedMinutes,
    actualMinutes,
    checkInRequest
  };
}

export function createPlannedVsActualEntry(
  dateIso: string,
  plannedMinutes: number,
  actualMinutes: number
): PlannedVsActualEntry {
  return {
    dateIso,
    plannedMinutes,
    actualMinutes
  };
}

export function calculateAverageGap(entries: PlannedVsActualEntry[]): number {
  if (entries.length === 0) return 0;
  
  const totalGapPercent = entries.reduce((sum, entry) => {
    return sum + calculateGapPercent(entry.plannedMinutes, entry.actualMinutes);
  }, 0);
  
  return totalGapPercent / entries.length;
}

export function hasConsistentGapPattern(entries: PlannedVsActualEntry[], minEntries: number = 3): boolean {
  if (entries.length < minEntries) return false;
  
  const recentEntries = entries.slice(-minEntries);
  const directions = recentEntries.map(e => {
    if (e.actualMinutes > e.plannedMinutes) return 'over';
    if (e.actualMinutes < e.plannedMinutes) return 'under';
    return 'none';
  });
  
  const allOver = directions.every(d => d === 'over');
  const allUnder = directions.every(d => d === 'under');
  
  return allOver || allUnder;
}
