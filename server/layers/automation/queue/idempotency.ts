// Layer 6: Automation Layer - Idempotency

import type { ExternalAction, IdempotencyEntry } from '../types/automationTypes.js';
import { getAutomationStore } from '../store/AutomationStore.js';
import { AUTOMATION_THRESHOLDS } from '../policies/thresholds.js';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function generateIdempotencyKey(action: ExternalAction): string {
  const payloadStr = JSON.stringify(action.payload || {});
  const payloadHash = simpleHash(payloadStr);
  return `${action.provider}:${action.operation}:${action.entityType}:${action.entityId}:${payloadHash}`;
}

export function checkIdempotency(key: string): IdempotencyEntry | null {
  const store = getAutomationStore();
  const entry = store.getIdempotencyEntry(key);
  
  if (!entry) {
    return null;
  }
  
  const entryTime = new Date(entry.createdAtIso).getTime();
  const now = Date.now();
  const ttlMs = AUTOMATION_THRESHOLDS.IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000;
  
  if (now - entryTime > ttlMs) {
    return null;
  }
  
  return entry;
}

export function setIdempotencyKey(key: string, jobId: string): void {
  const store = getAutomationStore();
  store.setIdempotencyEntry(key, {
    createdAtIso: new Date().toISOString(),
    jobId
  });
}
