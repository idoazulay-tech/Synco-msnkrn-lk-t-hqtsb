// Layer 7: Feedback & Review Layer - Core Types

export type FeedbackType = 'reflection' | 'post_action' | 'daily_review' | 'system';
export type ToneType = 'neutral' | 'gentle' | 'direct';
export type ShowAsType = 'card' | 'toast' | 'modal';
export type PriorityType = 'low' | 'medium' | 'high';
export type RelatedLayer = 'intent' | 'decision' | 'task' | 'learning' | 'automation';
export type EntityType = 'task' | 'event' | 'job' | 'rule' | 'none';

export interface FeedbackMessage {
  id: string;
  tsIso: string;
  type: FeedbackType;
  tone: ToneType;
  titleHebrew: string;
  bodyHebrew: string;
  microStepHebrew: string;
  related: {
    layer: RelatedLayer;
    entityType: EntityType;
    entityId: string | null;
  };
  ui: {
    showAs: ShowAsType;
    priority: PriorityType;
  };
}

export type CheckInReason = 'duration_mismatch' | 'wrong_intent' | 'stress_signal' | 'automation_failed';
export type ExpectedAnswerType = 'choice' | 'free_text' | 'confirm';

export interface CheckInRequest {
  id: string;
  tsIso: string;
  reason: CheckInReason;
  questionHebrew: string;
  expectedAnswerType: ExpectedAnswerType;
  options: string[];
  relatedEntityId?: string;
  cooldownUntilIso?: string;
}

export interface PlannedVsActualEntry {
  dateIso: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface CompletionRateEntry {
  dateIso: string;
  completed: number;
  total: number;
}

export type StressLevel = 'low' | 'medium' | 'high';

export interface StressSignalEntry {
  dateIso: string;
  level: StressLevel;
}

export interface FeedbackStats {
  plannedVsActual: PlannedVsActualEntry[];
  completionRateByDay: CompletionRateEntry[];
  stressSignalsByDay: StressSignalEntry[];
}

export interface FeedbackContext {
  cognitiveLoad: 'low' | 'medium' | 'high';
  recentCancellations: number;
  recentFailedJobs: number;
  lastDailyReviewIso: string | null;
  currentStressLevel: StressLevel;
}

export interface ReflectionInput {
  decision: 'execute' | 'ask' | 'reflect' | 'stop';
  confidence: number;
  missingInfo: string[];
  actionType?: string;
  taskTitle?: string;
}

export interface PostActionInput {
  action: 'mark_done' | 'cancel' | 'reschedule' | 'create';
  entityType: EntityType;
  entityId: string;
  title: string;
  remainingCount?: number;
  plannedMinutes?: number;
  actualMinutes?: number;
}

export interface AutomationFeedbackInput {
  jobId: string;
  status: 'success' | 'failed' | 'needs_user_action';
  provider: string;
  actionType: string;
  entityTitle?: string;
  errorMessage?: string;
}

export interface DailyReviewData {
  dateIso: string;
  completed: number;
  total: number;
  topBlocker?: string;
  topMust?: string;
  microStep: string;
}

export interface FeedbackUIInstructions {
  showFeedbackCard: boolean;
  feedbackMessage: FeedbackMessage | null;
  showCheckInModal: boolean;
  checkInRequest: CheckInRequest | null;
  showDailyReview: boolean;
  dailyReviewData: DailyReviewData | null;
}
