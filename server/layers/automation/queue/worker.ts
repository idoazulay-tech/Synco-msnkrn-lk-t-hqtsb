// Layer 6: Automation Layer - Worker

import type { Job, ConnectorResult } from '../types/automationTypes.js';
import { getAutomationStore } from '../store/AutomationStore.js';
import { getNextJob, updateJobStatus } from './jobQueue.js';
import { classifyError, shouldRetry, calculateNextRetryTime } from './retryPolicy.js';
import { canMakeRequest, recordRequest } from './rateLimiter.js';
import { getTimeout } from '../policies/timeouts.js';
import { AUTOMATION_THRESHOLDS } from '../policies/thresholds.js';
import { MockConnector } from '../connectors/mock/MockConnector.js';
import { GoogleCalendarConnector } from '../connectors/google/GoogleCalendarConnector.js';
import type { IConnector } from '../connectors/Connector.js';

const connectors: Record<string, IConnector> = {
  mock: new MockConnector(),
  google_calendar: new GoogleCalendarConnector()
};

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

function getConnector(provider: string): IConnector | null {
  return connectors[provider] || null;
}

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Operation timed out'));
    }, ms);
    
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function createAuditEntry(job: Job, status: 'success' | 'failed' | 'needs_user_action', details: any): void {
  const store = getAutomationStore();
  
  const summaryMap: Record<string, string> = {
    success: `הפעולה "${job.operation}" הושלמה בהצלחה`,
    failed: `הפעולה "${job.operation}" נכשלה`,
    needs_user_action: `נדרשת פעולה מהמשתמש עבור "${job.operation}"`
  };
  
  store.addAuditEntry({
    provider: job.provider,
    operation: job.operation,
    entityType: job.entityType,
    entityId: job.entityId,
    status,
    summaryHebrew: summaryMap[status],
    details
  });
}

async function processJob(job: Job): Promise<void> {
  const store = getAutomationStore();
  const connector = getConnector(job.provider);
  
  if (!connector) {
    updateJobStatus(job.id, 'failed', {
      lastError: `Unknown provider: ${job.provider}`,
      attempts: job.attempts + 1
    });
    createAuditEntry(job, 'failed', { error: `Unknown provider: ${job.provider}` });
    return;
  }
  
  if (!connector.validateIntegration(store)) {
    updateJobStatus(job.id, 'needs_user_action', {
      lastError: 'Integration not connected',
      attempts: job.attempts + 1
    });
    createAuditEntry(job, 'needs_user_action', { 
      error: 'Integration not connected',
      provider: job.provider 
    });
    return;
  }
  
  if (!canMakeRequest(job.provider)) {
    updateJobStatus(job.id, 'queued', {
      nextRetryAtIso: new Date(Date.now() + 5000).toISOString()
    });
    return;
  }
  
  updateJobStatus(job.id, 'running', {
    attempts: job.attempts + 1
  });
  
  recordRequest(job.provider);
  
  try {
    const timeoutMs = getTimeout(job.provider, job.operation);
    const result: ConnectorResult = await timeoutPromise(
      connector.execute(job.operation, job.payload),
      timeoutMs
    );
    
    if (result.ok) {
      updateJobStatus(job.id, 'success', {
        result: result.data,
        lastError: null
      });
      createAuditEntry(job, 'success', result.data);
    } else if (result.status === 'needs_user_action') {
      updateJobStatus(job.id, 'needs_user_action', {
        lastError: result.error || 'User action required',
        result: result.data
      });
      createAuditEntry(job, 'needs_user_action', { error: result.error, data: result.data });
    } else {
      const errorType = result.errorType || classifyError(result.error || 'Unknown error');
      const canRetry = shouldRetry(job, errorType);
      
      if (canRetry) {
        const nextRetry = calculateNextRetryTime(job);
        updateJobStatus(job.id, 'queued', {
          lastError: result.error,
          nextRetryAtIso: nextRetry
        });
      } else {
        updateJobStatus(job.id, 'failed', {
          lastError: result.error
        });
        createAuditEntry(job, 'failed', { error: result.error });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorType = classifyError(errorMessage);
    const canRetry = shouldRetry({ ...job, attempts: job.attempts + 1 }, errorType);
    
    if (canRetry) {
      const nextRetry = calculateNextRetryTime({ ...job, attempts: job.attempts + 1 });
      updateJobStatus(job.id, 'queued', {
        lastError: errorMessage,
        nextRetryAtIso: nextRetry
      });
    } else {
      updateJobStatus(job.id, 'failed', {
        lastError: errorMessage
      });
      createAuditEntry(job, 'failed', { error: errorMessage });
    }
  }
}

async function pollAndProcess(): Promise<void> {
  if (isProcessing) return;
  
  isProcessing = true;
  
  try {
    const job = getNextJob();
    if (job) {
      await processJob(job);
    }
  } catch (error) {
    const store = getAutomationStore();
    store.addError(error instanceof Error ? error.message : 'Worker error');
  } finally {
    isProcessing = false;
  }
}

export function startWorker(): void {
  if (workerInterval) return;
  
  workerInterval = setInterval(
    pollAndProcess, 
    AUTOMATION_THRESHOLDS.WORKER_POLL_INTERVAL_MS
  );
  
  console.log('Automation worker started');
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('Automation worker stopped');
  }
}

export function isWorkerRunning(): boolean {
  return workerInterval !== null;
}

export async function processNextJobNow(): Promise<Job | null> {
  const job = getNextJob();
  if (!job) return null;
  
  await processJob(job);
  return getAutomationStore().getJob(job.id);
}
