// Layer 6: Automation Layer - Retry Policy

import type { Job } from '../types/automationTypes.js';
import { AUTOMATION_THRESHOLDS } from '../policies/thresholds.js';

export type ErrorClassification = 'transient' | 'permanent' | 'auth';

const BACKOFF_SCHEDULE_MS = [1000, 3000, 7000, 15000, 30000];

export function classifyError(error: string): ErrorClassification {
  const lowerError = error.toLowerCase();
  
  if (
    lowerError.includes('unauthorized') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('auth') ||
    lowerError.includes('permission') ||
    lowerError.includes('token expired') ||
    lowerError.includes('invalid credentials')
  ) {
    return 'auth';
  }
  
  if (
    lowerError.includes('not found') ||
    lowerError.includes('invalid') ||
    lowerError.includes('bad request') ||
    lowerError.includes('validation failed')
  ) {
    return 'permanent';
  }
  
  return 'transient';
}

export function getBackoffDelay(attemptNumber: number): number {
  const index = Math.min(attemptNumber - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[Math.max(0, index)];
}

export function calculateNextRetryTime(job: Job): string {
  const delayMs = getBackoffDelay(job.attempts);
  const nextRetry = new Date(Date.now() + delayMs);
  return nextRetry.toISOString();
}

export function shouldRetry(job: Job, errorType: ErrorClassification): boolean {
  if (errorType === 'permanent' || errorType === 'auth') {
    return false;
  }
  
  return job.attempts < job.maxAttempts;
}

export function getMaxAttempts(): number {
  return AUTOMATION_THRESHOLDS.DEFAULT_MAX_ATTEMPTS;
}
