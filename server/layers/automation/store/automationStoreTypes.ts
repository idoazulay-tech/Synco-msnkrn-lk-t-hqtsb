// Layer 6: Automation Layer - Store Types

import type { 
  Job, 
  AuditLogEntry, 
  IntegrationsState, 
  IdempotencyEntry 
} from '../types/automationTypes.js';

export interface AutomationStoreState {
  integrations: IntegrationsState;
  automationJobs: Job[];
  auditLog: AuditLogEntry[];
  idempotencyKeys: Record<string, IdempotencyEntry>;
  lastAutomationErrors: string[];
}

export interface IAutomationStore {
  getState(): AutomationStoreState;
  
  // Integrations
  getIntegrations(): IntegrationsState;
  setIntegrationStatus(provider: 'mock' | 'googleCalendar', status: 'connected' | 'disconnected' | 'error', email?: string): void;
  
  // Jobs
  addJob(job: Job): void;
  updateJob(id: string, updates: Partial<Job>): Job | null;
  getJob(id: string): Job | null;
  getJobsByStatus(status: Job['status']): Job[];
  getNextQueuedJob(): Job | null;
  getRecentJobs(limit: number): Job[];
  
  // Audit Log
  addAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'tsIso'>): AuditLogEntry;
  getRecentAuditEntries(limit: number): AuditLogEntry[];
  
  // Idempotency
  getIdempotencyEntry(key: string): IdempotencyEntry | null;
  setIdempotencyEntry(key: string, entry: IdempotencyEntry): void;
  
  // Errors
  addError(error: string): void;
  getLastErrors(): string[];
  clearErrors(): void;
  
  // Reset
  reset(): void;
}
