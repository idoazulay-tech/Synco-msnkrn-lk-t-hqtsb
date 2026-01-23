// Layer 6: Automation Layer - In-Memory Store

import type { 
  Job, 
  AuditLogEntry, 
  IntegrationsState, 
  IdempotencyEntry 
} from '../types/automationTypes.js';
import type { AutomationStoreState, IAutomationStore } from './automationStoreTypes.js';

function generateId(): string {
  return `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class AutomationStore implements IAutomationStore {
  private state: AutomationStoreState;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): AutomationStoreState {
    return {
      integrations: {
        mock: { status: 'connected' },
        googleCalendar: { status: 'disconnected' }
      },
      automationJobs: [],
      auditLog: [],
      idempotencyKeys: {},
      lastAutomationErrors: []
    };
  }

  getState(): AutomationStoreState {
    return { ...this.state };
  }

  // Integrations
  getIntegrations(): IntegrationsState {
    return { ...this.state.integrations };
  }

  setIntegrationStatus(
    provider: 'mock' | 'googleCalendar', 
    status: 'connected' | 'disconnected' | 'error', 
    email?: string
  ): void {
    this.state.integrations[provider] = {
      ...this.state.integrations[provider],
      status,
      accountEmail: email,
      connectedAtIso: status === 'connected' ? new Date().toISOString() : undefined
    };
  }

  // Jobs
  addJob(job: Job): void {
    this.state.automationJobs.push(job);
  }

  updateJob(id: string, updates: Partial<Job>): Job | null {
    const index = this.state.automationJobs.findIndex(j => j.id === id);
    if (index === -1) return null;
    
    this.state.automationJobs[index] = {
      ...this.state.automationJobs[index],
      ...updates,
      updatedAtIso: new Date().toISOString()
    };
    return this.state.automationJobs[index];
  }

  getJob(id: string): Job | null {
    return this.state.automationJobs.find(j => j.id === id) || null;
  }

  getJobsByStatus(status: Job['status']): Job[] {
    return this.state.automationJobs.filter(j => j.status === status);
  }

  getNextQueuedJob(): Job | null {
    const now = new Date().toISOString();
    return this.state.automationJobs.find(j => 
      j.status === 'queued' && 
      (!j.nextRetryAtIso || j.nextRetryAtIso <= now)
    ) || null;
  }

  getRecentJobs(limit: number): Job[] {
    return [...this.state.automationJobs]
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
      .slice(0, limit);
  }

  // Audit Log
  addAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'tsIso'>): AuditLogEntry {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: generateId(),
      tsIso: new Date().toISOString()
    };
    this.state.auditLog.push(newEntry);
    return newEntry;
  }

  getRecentAuditEntries(limit: number): AuditLogEntry[] {
    return [...this.state.auditLog]
      .sort((a, b) => b.tsIso.localeCompare(a.tsIso))
      .slice(0, limit);
  }

  // Idempotency
  getIdempotencyEntry(key: string): IdempotencyEntry | null {
    return this.state.idempotencyKeys[key] || null;
  }

  setIdempotencyEntry(key: string, entry: IdempotencyEntry): void {
    this.state.idempotencyKeys[key] = entry;
  }

  // Errors
  addError(error: string): void {
    this.state.lastAutomationErrors.push(error);
    if (this.state.lastAutomationErrors.length > 10) {
      this.state.lastAutomationErrors.shift();
    }
  }

  getLastErrors(): string[] {
    return [...this.state.lastAutomationErrors];
  }

  clearErrors(): void {
    this.state.lastAutomationErrors = [];
  }

  // Reset
  reset(): void {
    this.state = this.getInitialState();
  }
}

// Singleton instance
let storeInstance: AutomationStore | null = null;

export function getAutomationStore(): AutomationStore {
  if (!storeInstance) {
    storeInstance = new AutomationStore();
  }
  return storeInstance;
}

export function resetAutomationStore(): void {
  if (storeInstance) {
    storeInstance.reset();
  }
}
