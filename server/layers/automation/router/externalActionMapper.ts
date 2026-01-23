// Layer 6: Automation Layer - External Action Mapper

import type { ExternalAction, ProviderType, OperationType, EntityType } from '../types/automationTypes.js';
import { getAutomationStore } from '../store/AutomationStore.js';
import { generateIdempotencyKey } from '../queue/idempotency.js';

export interface InternalAction {
  actionType: string;
  entityType: EntityType;
  entityId: string;
  payload: any;
}

const ACTION_TO_OPERATION_MAP: Record<string, OperationType> = {
  create_event: 'create',
  update_event: 'update',
  cancel_event: 'delete',
  delete_event: 'delete',
  create_task: 'create',
  update_task: 'update',
  cancel_task: 'delete',
  sync_calendar: 'sync'
};

const ACTION_TO_ENTITY_MAP: Record<string, EntityType> = {
  create_event: 'event',
  update_event: 'event',
  cancel_event: 'event',
  delete_event: 'event',
  create_task: 'task',
  update_task: 'task',
  cancel_task: 'task'
};

export function shouldCreateExternalAction(actionType: string): boolean {
  return actionType in ACTION_TO_OPERATION_MAP;
}

export function getPreferredProvider(entityType: EntityType): ProviderType {
  const store = getAutomationStore();
  const integrations = store.getIntegrations();
  
  if (entityType === 'event' && integrations.googleCalendar.status === 'connected') {
    return 'google_calendar';
  }
  
  return 'mock';
}

export function isIntegrationConnected(provider: ProviderType): boolean {
  const store = getAutomationStore();
  const integrations = store.getIntegrations();
  
  if (provider === 'mock') {
    return integrations.mock.status === 'connected';
  }
  
  if (provider === 'google_calendar') {
    return integrations.googleCalendar.status === 'connected';
  }
  
  return false;
}

export function mapToExternalAction(internalAction: InternalAction): ExternalAction | null {
  const operation = ACTION_TO_OPERATION_MAP[internalAction.actionType];
  if (!operation) {
    return null;
  }
  
  const entityType = ACTION_TO_ENTITY_MAP[internalAction.actionType] || internalAction.entityType;
  const provider = getPreferredProvider(entityType);
  
  const externalAction: ExternalAction = {
    provider,
    operation,
    entityType,
    entityId: internalAction.entityId,
    payload: internalAction.payload,
    idempotencyKey: ''
  };
  
  externalAction.idempotencyKey = generateIdempotencyKey(externalAction);
  
  return externalAction;
}

export function createExternalActionsFromState(
  actionType: string,
  entityId: string,
  payload: any
): ExternalAction[] {
  const actions: ExternalAction[] = [];
  
  if (!shouldCreateExternalAction(actionType)) {
    return actions;
  }
  
  const entityType = ACTION_TO_ENTITY_MAP[actionType];
  if (!entityType) {
    return actions;
  }
  
  const internalAction: InternalAction = {
    actionType,
    entityType,
    entityId,
    payload
  };
  
  const externalAction = mapToExternalAction(internalAction);
  if (externalAction) {
    actions.push(externalAction);
  }
  
  return actions;
}
