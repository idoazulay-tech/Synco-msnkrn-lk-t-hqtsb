// Layer 6: Automation Layer - Action Router

import type { ExternalAction, AuditLogEntry, AutomationUIInstructions } from '../types/automationTypes.js';
import { getAutomationStore } from '../store/AutomationStore.js';
import { enqueue, getRecentJobs } from '../queue/jobQueue.js';
import { isIntegrationConnected, createExternalActionsFromState } from './externalActionMapper.js';

export interface RouteResult {
  jobsCreated: number;
  jobIds: string[];
  auditEntries: AuditLogEntry[];
  needsUserAction: boolean;
}

function createNeedsUserActionAudit(action: ExternalAction): AuditLogEntry {
  const store = getAutomationStore();
  
  return store.addAuditEntry({
    provider: action.provider,
    operation: action.operation,
    entityType: action.entityType,
    entityId: action.entityId,
    status: 'needs_user_action',
    summaryHebrew: `נדרש חיבור ל-${action.provider === 'google_calendar' ? 'Google Calendar' : action.provider}`,
    details: {
      message: 'Integration not connected',
      action: 'Please connect the integration in Settings'
    }
  });
}

export function routeExternalAction(action: ExternalAction): RouteResult {
  const result: RouteResult = {
    jobsCreated: 0,
    jobIds: [],
    auditEntries: [],
    needsUserAction: false
  };
  
  if (!isIntegrationConnected(action.provider)) {
    const auditEntry = createNeedsUserActionAudit(action);
    result.auditEntries.push(auditEntry);
    result.needsUserAction = true;
    return result;
  }
  
  try {
    const enqueueResult = enqueue(action);
    
    if (enqueueResult.created) {
      result.jobsCreated = 1;
    }
    result.jobIds.push(enqueueResult.job.id);
  } catch (error) {
    const store = getAutomationStore();
    store.addError(error instanceof Error ? error.message : 'Failed to enqueue job');
    result.needsUserAction = true;
  }
  
  return result;
}

export function routeMultipleActions(actions: ExternalAction[]): RouteResult {
  const combinedResult: RouteResult = {
    jobsCreated: 0,
    jobIds: [],
    auditEntries: [],
    needsUserAction: false
  };
  
  for (const action of actions) {
    const result = routeExternalAction(action);
    combinedResult.jobsCreated += result.jobsCreated;
    combinedResult.jobIds.push(...result.jobIds);
    combinedResult.auditEntries.push(...result.auditEntries);
    combinedResult.needsUserAction = combinedResult.needsUserAction || result.needsUserAction;
  }
  
  return combinedResult;
}

export function routeFromInternalAction(
  actionType: string,
  entityId: string,
  payload: any
): RouteResult {
  const externalActions = createExternalActionsFromState(actionType, entityId, payload);
  return routeMultipleActions(externalActions);
}

export function getAutomationUIInstructions(): AutomationUIInstructions {
  const recentJobs = getRecentJobs(10);
  
  return {
    jobsCreated: recentJobs.filter(j => 
      new Date(j.createdAtIso).getTime() > Date.now() - 60000
    ).length,
    lastStatuses: recentJobs.slice(0, 5).map(j => ({
      jobId: j.id,
      status: j.status,
      provider: j.provider,
      operation: j.operation
    })),
    needsUserAction: recentJobs.some(j => j.status === 'needs_user_action')
  };
}
