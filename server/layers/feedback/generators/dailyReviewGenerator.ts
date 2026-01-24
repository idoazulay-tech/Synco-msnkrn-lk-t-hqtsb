// Layer 7: Daily Review Generator

import type { 
  FeedbackMessage, 
  FeedbackContext,
  DailyReviewData,
  CompletionRateEntry
} from '../types/feedbackTypes.js';
import { shouldTriggerDailyReview } from '../policies/triggers.js';
import { DAILY_REVIEW_TEMPLATES, applyTemplate } from '../policies/templates.js';
import { determineTone } from '../policies/tonePolicy.js';
import { shouldBlockDailyReview } from '../analyzers/overloadAnalyzer.js';

export interface DailyReviewResult {
  shouldShowReview: boolean;
  feedbackMessage: FeedbackMessage | null;
  reviewData: DailyReviewData | null;
}

export interface DailyReviewInput {
  completedToday: number;
  totalToday: number;
  topBlocker?: string;
  topMust?: string;
  pendingTasks: Array<{ id: string; title: string; mustLock: boolean }>;
}

export function generateDailyReview(
  input: DailyReviewInput,
  context: FeedbackContext,
  forceGenerate: boolean = false
): DailyReviewResult {
  if (!forceGenerate) {
    if (shouldBlockDailyReview(context)) {
      return {
        shouldShowReview: false,
        feedbackMessage: null,
        reviewData: null
      };
    }
    
    const triggerResult = shouldTriggerDailyReview(context);
    if (!triggerResult.shouldTrigger) {
      return {
        shouldShowReview: false,
        feedbackMessage: null,
        reviewData: null
      };
    }
  }
  
  const tone = determineTone(context);
  const dateIso = new Date().toISOString().split('T')[0];
  
  const microStep = generateReviewMicroStep(input, context);
  
  const topBlocker = input.topBlocker || findTopBlocker(input.pendingTasks);
  const topMust = input.topMust || findTopMust(input.pendingTasks);
  
  const reviewData: DailyReviewData = {
    dateIso,
    completed: input.completedToday,
    total: input.totalToday,
    topBlocker,
    topMust,
    microStep
  };
  
  let bodyLines: string[] = [];
  
  bodyLines.push(applyTemplate(DAILY_REVIEW_TEMPLATES.completion, tone, {
    completed: input.completedToday,
    total: input.totalToday
  }));
  
  if (topBlocker) {
    bodyLines.push(applyTemplate(DAILY_REVIEW_TEMPLATES.topBlocker, tone, {
      blocker: topBlocker
    }));
  }
  
  if (topMust) {
    bodyLines.push(applyTemplate(DAILY_REVIEW_TEMPLATES.topMust, tone, {
      must: topMust
    }));
  }
  
  bodyLines.push(applyTemplate(DAILY_REVIEW_TEMPLATES.microStep, tone, {
    step: microStep
  }));
  
  const feedbackMessage: FeedbackMessage = {
    id: `daily-review-${dateIso}`,
    tsIso: new Date().toISOString(),
    type: 'daily_review',
    tone,
    titleHebrew: applyTemplate(DAILY_REVIEW_TEMPLATES.header, tone, {}),
    bodyHebrew: bodyLines.join('\n'),
    microStepHebrew: microStep,
    related: {
      layer: 'task',
      entityType: 'none',
      entityId: null
    },
    ui: {
      showAs: 'card',
      priority: 'medium'
    }
  };
  
  return {
    shouldShowReview: true,
    feedbackMessage,
    reviewData
  };
}

function findTopBlocker(tasks: Array<{ id: string; title: string; mustLock: boolean }>): string | undefined {
  return undefined;
}

function findTopMust(tasks: Array<{ id: string; title: string; mustLock: boolean }>): string | undefined {
  const mustTask = tasks.find(t => t.mustLock);
  return mustTask?.title;
}

function generateReviewMicroStep(input: DailyReviewInput, context: FeedbackContext): string {
  if (context.currentStressLevel === 'high') {
    return '5 דקות לסדר דבר אחד קטן';
  }
  
  if (input.pendingTasks.length > 5) {
    return 'סמן משימה אחת כ Must';
  }
  
  const mustTasks = input.pendingTasks.filter(t => t.mustLock);
  if (mustTasks.length === 0 && input.pendingTasks.length > 0) {
    return 'בחר את המשימה הכי חשובה להיום';
  }
  
  return 'התחל במשימה הראשונה ברשימה';
}

export function createCompletionRateEntry(completed: number, total: number): CompletionRateEntry {
  return {
    dateIso: new Date().toISOString().split('T')[0],
    completed,
    total
  };
}

export function calculateCompletionRate(entry: CompletionRateEntry): number {
  if (entry.total === 0) return 100;
  return Math.round((entry.completed / entry.total) * 100);
}
