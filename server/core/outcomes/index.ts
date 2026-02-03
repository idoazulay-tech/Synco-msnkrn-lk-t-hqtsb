/**
 * Outcome Anchor & Backward Planning Layer
 * שכבת חוק-על: תכנון לאחור מתוצאה מחויבת למציאות
 * 
 * Layer 1: Core / Laws / Gates
 * החוק נאכף לפני Scheduler
 */

export {
  OutcomeAnchor,
  LinkedTask,
  BackwardPlan,
  OutcomeDetectionResult,
  OutcomeGateDecision,
  OutcomeOperation,
  OutcomeOperationType,
  OutcomeScheduleState,
  DEFAULT_ADHD_BUFFER_MINUTES,
  OUTCOME_TRIGGER_PHRASES_HE,
  PREPARATION_KEYWORDS_HE
} from './types';

export {
  detectOutcomeFromText,
  isPreparationTask
} from './detector';

export {
  createOutcomeAnchor,
  buildBackwardPlan,
  canAddTaskToPlan,
  getScheduleForLinkedTasks,
  recalculatePlanWithCurrentTime
} from './planner';

export {
  enforceOutcomeAnchorLayer,
  checkChainIntegrity,
  canFillGapsBumpLinked
} from './gate';
