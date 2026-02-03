/**
 * Outcome Anchor & Backward Planning Layer - Types
 * שכבת חוק-על: תכנון לאחור מתוצאה מחויבת
 * 
 * Layer 1: Core / Laws / Gates
 * 
 * עיקרון: תכנון זמן מתחיל מתוצאה מחויבת למציאות (Outcome),
 * ולא מרשימת משימות.
 */

import { TimeConstraintType } from '../timeConstraints/types';

export interface OutcomeAnchor {
  id: string;
  title: string;
  deadlineTime: Date;
  bufferMinutes: number;
  linkedTaskIds: string[];
  timeConstraint: TimeConstraintType.HARD_LOCK;
  createdAt: Date;
  source: 'detected' | 'manual';
  originalText?: string;
}

export interface LinkedTask {
  id: string;
  title: string;
  durationMinutes: number;
  order: number;
  linkedOutcomeId: string;
  earliestStart?: Date;
  latestEnd: Date;
  isFlexible: boolean;
}

export interface BackwardPlan {
  outcomeId: string;
  deadlineTime: Date;
  totalDurationMinutes: number;
  requiredStartTime: Date;
  tasks: LinkedTask[];
  hasEnoughTime: boolean;
  shortfallMinutes?: number;
}

export interface OutcomeDetectionResult {
  isOutcome: boolean;
  confidence: number;
  deadlineTime?: Date;
  suggestedBuffer: number;
  reason: string;
  triggerPhrase?: string;
}

export interface OutcomeGateDecision {
  allowed: boolean;
  reason: string;
  affectedOutcomeId?: string;
  chainBreakType?: 'removes_linked' | 'moves_linked' | 'time_conflict' | 'deadline_breach';
}

export type OutcomeOperationType = 
  | 'create_task'
  | 'delete_task'
  | 'move_task'
  | 'reschedule_outcome'
  | 'optimize';

export interface OutcomeOperation {
  operationType: OutcomeOperationType;
  taskId?: string;
  outcomeId?: string;
  proposedStartTime?: Date;
  proposedEndTime?: Date;
  isAutomatic: boolean;
}

export interface OutcomeScheduleState {
  currentTime: Date;
  outcomes: OutcomeAnchor[];
  linkedTasks: LinkedTask[];
  allTasks: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    linkedOutcomeId?: string;
    timeConstraint: TimeConstraintType;
  }>;
}

export const DEFAULT_ADHD_BUFFER_MINUTES = 15;

export const OUTCOME_TRIGGER_PHRASES_HE = [
  'צריך לצאת ב',
  'צריכה לצאת ב',
  'יש לי אוטובוס ב',
  'העבודה מתחילה ב',
  'לפני שאני נוסע',
  'לפני שאני יוצא',
  'עד שאני מגיע',
  'חייב להיות ב',
  'חייבת להיות ב',
  'יש לי פגישה ב',
  'הטיסה ב',
  'הרכבת ב',
  'צריך להגיע ב',
  'צריכה להגיע ב',
  'מתחיל ב',
  'מתחילה ב',
  'נוסע ב',
  'נוסעת ב',
  'יוצא ב',
  'יוצאת ב'
];

export const PREPARATION_KEYWORDS_HE = [
  'להתארגן',
  'להתלבש',
  'לאכול ארוחת בוקר',
  'להתקלח',
  'להתכונן',
  'הכנה',
  'לארוז',
  'לסדר',
  'להכין'
];
