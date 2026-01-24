// Layer 7: Feedback & Review Layer Tests

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FeedbackReviewLayer, resetFeedbackLayer } from '../FeedbackReviewLayer.js';
import { resetFeedbackStore, getFeedbackStore } from '../store/FeedbackStore.js';
import { generateReflection } from '../generators/reflectionGenerator.js';
import { generatePostActionFeedback } from '../generators/postActionGenerator.js';
import { generateDailyReview } from '../generators/dailyReviewGenerator.js';
import { analyzeGap } from '../analyzers/gapAnalyzer.js';
import { analyzeAutomationResult } from '../analyzers/successFailureAnalyzer.js';
import { analyzeOverload } from '../analyzers/overloadAnalyzer.js';
import type { FeedbackContext, ReflectionInput, PostActionInput } from '../types/feedbackTypes.js';

describe('Layer 7: Feedback & Review Layer', () => {
  let layer: FeedbackReviewLayer;
  
  const defaultContext: FeedbackContext = {
    cognitiveLoad: 'low',
    recentCancellations: 0,
    recentFailedJobs: 0,
    lastDailyReviewIso: null,
    currentStressLevel: 'low'
  };
  
  beforeEach(() => {
    resetFeedbackLayer();
    resetFeedbackStore();
    layer = new FeedbackReviewLayer();
  });
  
  describe('Reflection Generation', () => {
    it('1) decision=ask generates reflection with missingInfoOne', () => {
      const input: ReflectionInput = {
        decision: 'ask',
        confidence: 0.8,
        missingInfo: ['שעה'],
        actionType: 'create_task',
        taskTitle: 'פגישה עם דני'
      };
      
      const result = generateReflection(input, defaultContext);
      
      expect(result.shouldShowReflection).toBe(true);
      expect(result.feedbackMessage).not.toBeNull();
      expect(result.feedbackMessage?.type).toBe('reflection');
      expect(result.feedbackMessage?.bodyHebrew).toContain('שעה');
    });
    
    it('2) decision=reflect generates reflection with microStep', () => {
      const input: ReflectionInput = {
        decision: 'reflect',
        confidence: 0.5,
        missingInfo: []
      };
      
      const result = generateReflection(input, defaultContext, 'בחר משימה אחת קטנה');
      
      expect(result.shouldShowReflection).toBe(true);
      expect(result.feedbackMessage?.microStepHebrew).toBeTruthy();
      expect(result.feedbackMessage?.ui.showAs).toBe('card');
    });
    
    it('3) execute with low confidence generates short reflection', () => {
      const input: ReflectionInput = {
        decision: 'execute',
        confidence: 0.6,
        missingInfo: [],
        taskTitle: 'משימה חדשה'
      };
      
      const result = generateReflection(input, defaultContext);
      
      expect(result.shouldShowReflection).toBe(true);
      expect(result.feedbackMessage?.titleHebrew).toBe('מתקדם');
    });
  });
  
  describe('Post-Action Feedback', () => {
    it('4) mark_done generates post_action and updates stats', () => {
      const input: PostActionInput = {
        action: 'mark_done',
        entityType: 'task',
        entityId: 'task-1',
        title: 'משימה שהושלמה',
        remainingCount: 3
      };
      
      const result = generatePostActionFeedback(input, defaultContext);
      
      expect(result.shouldShowFeedback).toBe(true);
      expect(result.feedbackMessage?.type).toBe('post_action');
      expect(result.feedbackMessage?.bodyHebrew).toContain('3');
      expect(result.updateStats).toBe(true);
    });
    
    it('5) cancel generates post_action with suggestion', () => {
      const input: PostActionInput = {
        action: 'cancel',
        entityType: 'task',
        entityId: 'task-2',
        title: 'משימה מבוטלת'
      };
      
      const result = generatePostActionFeedback(input, defaultContext);
      
      expect(result.shouldShowFeedback).toBe(true);
      expect(result.feedbackMessage?.titleHebrew).toBe('בוטל');
      expect(result.feedbackMessage?.microStepHebrew).toBeTruthy();
    });
    
    it('6) reschedule generates change notification', () => {
      const input: PostActionInput = {
        action: 'reschedule',
        entityType: 'task',
        entityId: 'task-3',
        title: 'משימה שהועברה'
      };
      
      const result = generatePostActionFeedback(input, defaultContext);
      
      expect(result.shouldShowFeedback).toBe(true);
      expect(result.feedbackMessage?.titleHebrew).toBe('הועבר');
    });
  });
  
  describe('Automation Feedback', () => {
    it('7) automation success generates success message', () => {
      const result = analyzeAutomationResult({
        jobId: 'job-1',
        status: 'success',
        provider: 'mock',
        actionType: 'create',
        entityTitle: 'אירוע ביומן'
      }, defaultContext);
      
      expect(result.feedbackMessage).not.toBeNull();
      expect(result.feedbackMessage?.titleHebrew).toBe('סנכרון הושלם');
      expect(result.shouldNotifyUser).toBe(true);
    });
    
    it('8) automation needs_user_action generates action message', () => {
      const result = analyzeAutomationResult({
        jobId: 'job-2',
        status: 'needs_user_action',
        provider: 'google_calendar',
        actionType: 'sync'
      }, defaultContext);
      
      expect(result.feedbackMessage).not.toBeNull();
      expect(result.feedbackMessage?.titleHebrew).toBe('נדרשת פעולה');
      expect(result.feedbackMessage?.ui.priority).toBe('high');
    });
  });
  
  describe('Gap Analysis', () => {
    it('9) gapAnalyzer creates pendingCheckIn when gap > threshold', () => {
      const result = analyzeGap(30, 50, 'task-1', defaultContext);
      
      expect(result.hasSignificantGap).toBe(true);
      expect(result.gapDirection).toBe('over');
      expect(result.checkInRequest).not.toBeNull();
      expect(result.checkInRequest?.reason).toBe('duration_mismatch');
    });
  });
  
  describe('CheckIn Responses', () => {
    it('10) checkin respond "כן" sends signal to learning', () => {
      const store = getFeedbackStore();
      store.setPendingCheckIn({
        id: 'checkin-1',
        tsIso: new Date().toISOString(),
        reason: 'duration_mismatch',
        questionHebrew: 'לעדכן זמן?',
        expectedAnswerType: 'choice',
        options: ['כן', 'לא עכשיו'],
        relatedEntityId: 'task-1'
      });
      
      const result = layer.respondToCheckIn('כן', 'checkin-1');
      
      expect(result.signalsForLearning.length).toBe(1);
      expect(result.signalsForLearning[0].type).toBe('duration_update');
      expect(result.signalsForLearning[0].data.confirmed).toBe(true);
    });
    
    it('11) checkin respond "לא עכשיו" creates cooldown', () => {
      const store = getFeedbackStore();
      store.setPendingCheckIn({
        id: 'checkin-2',
        tsIso: new Date().toISOString(),
        reason: 'duration_mismatch',
        questionHebrew: 'לעדכן זמן?',
        expectedAnswerType: 'choice',
        options: ['כן', 'לא עכשיו']
      });
      
      layer.respondToCheckIn('לא עכשיו', 'checkin-2');
      
      expect(store.isCheckInOnCooldown('duration_mismatch')).toBe(true);
    });
  });
  
  describe('Daily Review', () => {
    it('12) dailyReviewGenerator does not run if stress high', () => {
      const highStressContext: FeedbackContext = {
        ...defaultContext,
        currentStressLevel: 'high'
      };
      
      const result = generateDailyReview({
        completedToday: 3,
        totalToday: 5,
        pendingTasks: []
      }, highStressContext, false);
      
      expect(result.shouldShowReview).toBe(false);
    });
    
    it('13) dailyReviewGenerator runs only once per day', () => {
      const recentReviewContext: FeedbackContext = {
        ...defaultContext,
        lastDailyReviewIso: new Date().toISOString()
      };
      
      const result = generateDailyReview({
        completedToday: 3,
        totalToday: 5,
        pendingTasks: []
      }, recentReviewContext, false);
      
      expect(result.shouldShowReview).toBe(false);
    });
  });
  
  describe('Overload Analysis', () => {
    it('14) overloadAnalyzer changes tone to gentle when overloaded', () => {
      const result = analyzeOverload('high', 4, 3);
      
      expect(result.isOverloaded).toBe(true);
      expect(result.currentStressLevel).toBe('high');
      expect(result.recommendedTone).toBe('gentle');
    });
  });
  
  describe('FeedbackReviewLayer Integration', () => {
    it('15) processReflection stores feedback in feed', () => {
      const result = layer.processReflection({
        decision: 'ask',
        confidence: 0.8,
        missingInfo: ['שעה']
      });
      
      expect(result.feedbackMessage).not.toBeNull();
      
      const feed = layer.getFeedbackFeed();
      expect(feed.length).toBe(1);
    });
    
    it('16) processPostAction with gap triggers checkIn', () => {
      const taskState = {
        tasks: [],
        events: [],
        notes: [],
        scheduleBlocks: [],
        lastQuestion: null,
        lastReflection: null,
        contextState: null,
        decisionLog: [],
        pendingPlanProposal: null
      };
      
      const result = layer.processPostAction({
        action: 'mark_done',
        entityType: 'task',
        entityId: 'task-1',
        title: 'משימה',
        plannedMinutes: 30,
        actualMinutes: 60
      }, taskState);
      
      expect(result.checkInRequest).not.toBeNull();
      expect(result.signalsForLearning.length).toBeGreaterThan(0);
    });
  });
});
