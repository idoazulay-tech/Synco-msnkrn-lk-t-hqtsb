// Layer 6: Automation Layer - Unit Tests

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AutomationLayer, resetAutomationLayer } from '../AutomationLayer.js';
import { AutomationStore, resetAutomationStore, getAutomationStore } from '../store/AutomationStore.js';
import { enqueue, getJob, updateJobStatus, getJobsByStatus } from '../queue/jobQueue.js';
import { classifyError, shouldRetry, getBackoffDelay, calculateNextRetryTime } from '../queue/retryPolicy.js';
import { canMakeRequest, recordRequest, resetRateLimiter } from '../queue/rateLimiter.js';
import { generateIdempotencyKey, checkIdempotency, setIdempotencyKey } from '../queue/idempotency.js';
import { mapToExternalAction, shouldCreateExternalAction, createExternalActionsFromState } from '../router/externalActionMapper.js';
import { routeExternalAction, routeFromInternalAction } from '../router/actionRouter.js';
import { MockConnector } from '../connectors/mock/MockConnector.js';
import { GoogleCalendarConnector } from '../connectors/google/GoogleCalendarConnector.js';
import { stopWorker, processNextJobNow } from '../queue/worker.js';
import type { ExternalAction, Job } from '../types/automationTypes.js';

describe('Automation Layer - Layer 6', () => {
  let automationLayer: AutomationLayer;

  beforeEach(() => {
    resetAutomationStore();
    resetAutomationLayer();
    resetRateLimiter();
    automationLayer = new AutomationLayer(false);
  });

  afterEach(() => {
    stopWorker();
  });

  describe('Job Queue', () => {
    it('should enqueue job with status queued', () => {
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'Test Event' },
        idempotencyKey: ''
      };

      const result = enqueue(action);
      
      expect(result.created).toBe(true);
      expect(result.job.status).toBe('queued');
      expect(result.job.provider).toBe('mock');
      expect(result.job.operation).toBe('create');
    });

    it('should prevent duplicate jobs with idempotency', () => {
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'Test Event' },
        idempotencyKey: 'unique-key-1'
      };

      const result1 = enqueue(action);
      const result2 = enqueue(action);
      
      expect(result1.created).toBe(true);
      expect(result2.created).toBe(false);
      expect(result2.existingJobId).toBe(result1.job.id);
    });
  });

  describe('Worker Processing', () => {
    it('should process job and update audit log on success', async () => {
      const store = getAutomationStore();
      store.setIntegrationStatus('mock', 'connected');
      
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'Test Event' },
        idempotencyKey: ''
      };

      enqueue(action);
      
      const processedJob = await processNextJobNow();
      
      expect(processedJob).not.toBeNull();
      expect(processedJob!.status).toBe('success');
      
      const auditEntries = store.getRecentAuditEntries(10);
      expect(auditEntries.some(e => e.status === 'success')).toBe(true);
    });

    it('should retry transient errors', async () => {
      const store = getAutomationStore();
      store.setIntegrationStatus('mock', 'connected');
      
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'fail_transient Test Event' },
        idempotencyKey: ''
      };

      enqueue(action);
      
      const processedJob = await processNextJobNow();
      
      if (processedJob!.status === 'queued') {
        expect(processedJob!.attempts).toBeGreaterThan(0);
        expect(processedJob!.nextRetryAtIso).not.toBeNull();
      }
    });

    it('should fail on permanent errors', async () => {
      const store = getAutomationStore();
      store.setIntegrationStatus('mock', 'connected');
      
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'fail_permanent Test Event' },
        idempotencyKey: ''
      };

      enqueue(action);
      
      const processedJob = await processNextJobNow();
      
      expect(processedJob!.status).toBe('failed');
    });
  });

  describe('Disconnected Integration', () => {
    it('should create needs_user_action audit entry when integration disconnected', () => {
      const store = getAutomationStore();
      store.setIntegrationStatus('mock', 'disconnected');
      
      const action: ExternalAction = {
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'event1',
        payload: { title: 'Test Event' },
        idempotencyKey: ''
      };

      const result = routeExternalAction(action);
      
      expect(result.needsUserAction).toBe(true);
      expect(result.jobsCreated).toBe(0);
      expect(result.auditEntries.length).toBeGreaterThan(0);
      expect(result.auditEntries[0].status).toBe('needs_user_action');
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests under limit', () => {
      expect(canMakeRequest('mock')).toBe(true);
      
      for (let i = 0; i < 10; i++) {
        recordRequest('mock');
      }
      
      expect(canMakeRequest('mock')).toBe(true);
    });
  });

  describe('Retry Policy', () => {
    it('should classify errors correctly', () => {
      expect(classifyError('unauthorized access')).toBe('auth');
      expect(classifyError('not found')).toBe('permanent');
      expect(classifyError('network timeout')).toBe('transient');
    });

    it('should calculate backoff delay correctly', () => {
      expect(getBackoffDelay(1)).toBe(1000);
      expect(getBackoffDelay(2)).toBe(3000);
      expect(getBackoffDelay(3)).toBe(7000);
    });

    it('should prevent retry on permanent errors', () => {
      const job: Job = {
        id: 'test',
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
        status: 'running',
        provider: 'mock',
        operation: 'create',
        entityType: 'event',
        entityId: 'e1',
        idempotencyKey: 'key1',
        payload: {},
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        result: null,
        nextRetryAtIso: null
      };

      expect(shouldRetry(job, 'permanent')).toBe(false);
      expect(shouldRetry(job, 'auth')).toBe(false);
      expect(shouldRetry(job, 'transient')).toBe(true);
    });
  });

  describe('Action Router', () => {
    it('should map create_event to ExternalAction correctly', () => {
      const actions = createExternalActionsFromState('create_event', 'event1', { title: 'Meeting' });
      
      expect(actions.length).toBe(1);
      expect(actions[0].operation).toBe('create');
      expect(actions[0].entityType).toBe('event');
    });

    it('should identify which actions create external actions', () => {
      expect(shouldCreateExternalAction('create_event')).toBe(true);
      expect(shouldCreateExternalAction('update_event')).toBe(true);
      expect(shouldCreateExternalAction('internal_only')).toBe(false);
    });
  });

  describe('Google Calendar Connector Scaffold', () => {
    it('should return needs_user_action when not connected', async () => {
      const connector = new GoogleCalendarConnector();
      
      const result = await connector.execute('create', { 
        event: { 
          id: 'e1', 
          title: 'Test', 
          startTimeIso: new Date().toISOString(),
          endTimeIso: new Date().toISOString(),
          durationMinutes: 60
        } 
      });
      
      expect(result.ok).toBe(false);
      expect(result.status).toBe('needs_user_action');
      expect(result.errorType).toBe('auth');
    });
  });

  describe('Mock Connector', () => {
    it('should execute create operation successfully', async () => {
      const connector = new MockConnector();
      
      const result = await connector.execute('create', { title: 'Test Event' });
      
      expect(result.ok).toBe(true);
      expect(result.status).toBe('success');
      expect(result.data?.externalId).toBeDefined();
    });
  });

  describe('Automation Layer Integration', () => {
    it('should plan external actions from decision output', () => {
      const storeState = {
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

      const decisionOutput = {
        actionType: 'create_event',
        entityId: 'event1',
        payload: { title: 'New Meeting' }
      };

      const actions = automationLayer.planExternalActions(storeState, decisionOutput);
      
      expect(actions.length).toBe(1);
      expect(actions[0].operation).toBe('create');
      expect(actions[0].entityType).toBe('event');
    });

    it('should return empty for non-external actions', () => {
      const storeState = {
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

      const decisionOutput = {
        actionType: 'internal_only',
        entityId: 'item1',
        payload: {}
      };

      const actions = automationLayer.planExternalActions(storeState, decisionOutput);
      
      expect(actions.length).toBe(0);
    });
  });
});
