// Layer 6: Automation Layer - Types

export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'needs_user_action';
export type ProviderType = 'mock' | 'google_calendar';
export type OperationType = 'create' | 'update' | 'delete' | 'sync';
export type EntityType = 'event' | 'task' | 'note';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Job {
  id: string;
  createdAtIso: string;
  updatedAtIso: string;
  status: JobStatus;
  provider: ProviderType;
  operation: OperationType;
  entityType: EntityType;
  entityId: string;
  idempotencyKey: string;
  payload: any;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  result: any | null;
  nextRetryAtIso: string | null;
}

export interface AuditLogEntry {
  id: string;
  tsIso: string;
  provider: ProviderType;
  operation: string;
  entityType: EntityType;
  entityId: string;
  status: 'success' | 'failed' | 'needs_user_action';
  summaryHebrew: string;
  details: any;
}

export interface ExternalAction {
  provider: ProviderType;
  operation: OperationType;
  entityType: EntityType;
  entityId: string;
  payload: any;
  idempotencyKey: string;
}

export interface Integration {
  status: IntegrationStatus;
  accountEmail?: string;
  connectedAtIso?: string;
  lastErrorMessage?: string;
}

export interface IntegrationsState {
  mock: Integration;
  googleCalendar: Integration;
}

export interface IdempotencyEntry {
  createdAtIso: string;
  jobId: string;
}

export interface ConnectorResult {
  ok: boolean;
  status: 'success' | 'failed' | 'needs_user_action';
  data?: any;
  error?: string;
  errorType?: 'transient' | 'permanent' | 'auth';
}

export interface AutomationUIInstructions {
  jobsCreated: number;
  lastStatuses: Array<{ jobId: string; status: JobStatus; provider: ProviderType; operation: OperationType }>;
  needsUserAction: boolean;
}
