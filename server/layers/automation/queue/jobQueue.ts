// Layer 6: Automation Layer - Job Queue

import type { Job, ExternalAction, JobStatus } from '../types/automationTypes.js';
import { getAutomationStore } from '../store/AutomationStore.js';
import { generateIdempotencyKey, checkIdempotency, setIdempotencyKey } from './idempotency.js';
import { getMaxAttempts } from './retryPolicy.js';
import { AUTOMATION_THRESHOLDS } from '../policies/thresholds.js';

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface EnqueueResult {
  job: Job;
  created: boolean;
  existingJobId?: string;
}

export function enqueue(action: ExternalAction): EnqueueResult {
  const store = getAutomationStore();
  const idempotencyKey = action.idempotencyKey || generateIdempotencyKey(action);
  
  const existingEntry = checkIdempotency(idempotencyKey);
  if (existingEntry) {
    const existingJob = store.getJob(existingEntry.jobId);
    if (existingJob) {
      return {
        job: existingJob,
        created: false,
        existingJobId: existingEntry.jobId
      };
    }
  }
  
  const currentJobs = store.getJobsByStatus('queued');
  if (currentJobs.length >= AUTOMATION_THRESHOLDS.MAX_JOBS_IN_QUEUE) {
    throw new Error('Job queue is full');
  }
  
  const now = new Date().toISOString();
  const jobId = generateJobId();
  
  const job: Job = {
    id: jobId,
    createdAtIso: now,
    updatedAtIso: now,
    status: 'queued',
    provider: action.provider,
    operation: action.operation,
    entityType: action.entityType,
    entityId: action.entityId,
    idempotencyKey,
    payload: action.payload,
    attempts: 0,
    maxAttempts: getMaxAttempts(),
    lastError: null,
    result: null,
    nextRetryAtIso: null
  };
  
  store.addJob(job);
  setIdempotencyKey(idempotencyKey, jobId);
  
  return { job, created: true };
}

export function getNextJob(): Job | null {
  const store = getAutomationStore();
  return store.getNextQueuedJob();
}

export function updateJobStatus(
  jobId: string, 
  status: JobStatus, 
  updates?: Partial<Job>
): Job | null {
  const store = getAutomationStore();
  return store.updateJob(jobId, { status, ...updates });
}

export function getJobsByStatus(status: JobStatus): Job[] {
  const store = getAutomationStore();
  return store.getJobsByStatus(status);
}

export function getRecentJobs(limit: number = 20): Job[] {
  const store = getAutomationStore();
  return store.getRecentJobs(limit);
}

export function getJob(jobId: string): Job | null {
  const store = getAutomationStore();
  return store.getJob(jobId);
}
