// Layer 6: Automation Layer - Mock Connector

import type { IConnector } from '../Connector.js';
import type { OperationType, ConnectorResult, ProviderType } from '../../types/automationTypes.js';
import type { IAutomationStore } from '../../store/automationStoreTypes.js';

function generateExternalId(): string {
  return `ext-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MockConnector implements IConnector {
  readonly name: ProviderType = 'mock';

  validateIntegration(store: IAutomationStore): boolean {
    const integrations = store.getIntegrations();
    return integrations.mock.status === 'connected';
  }

  async execute(operation: OperationType, payload: any): Promise<ConnectorResult> {
    await delay(100 + Math.random() * 200);
    
    const payloadStr = JSON.stringify(payload || {});
    
    if (payloadStr.includes('fail_permanent')) {
      return {
        ok: false,
        status: 'failed',
        error: 'Permanent error: Invalid request',
        errorType: 'permanent'
      };
    }
    
    if (payloadStr.includes('fail_auth')) {
      return {
        ok: false,
        status: 'needs_user_action',
        error: 'Authorization required',
        errorType: 'auth'
      };
    }
    
    if (payloadStr.includes('fail_transient')) {
      if (Math.random() > 0.5) {
        return {
          ok: false,
          status: 'failed',
          error: 'Transient network error',
          errorType: 'transient'
        };
      }
    }
    
    switch (operation) {
      case 'create':
        return {
          ok: true,
          status: 'success',
          data: {
            externalId: generateExternalId(),
            createdAt: new Date().toISOString()
          }
        };
      
      case 'update':
        return {
          ok: true,
          status: 'success',
          data: {
            updatedAt: new Date().toISOString()
          }
        };
      
      case 'delete':
        return {
          ok: true,
          status: 'success',
          data: {
            deletedAt: new Date().toISOString()
          }
        };
      
      case 'sync':
        return {
          ok: true,
          status: 'success',
          data: {
            syncedAt: new Date().toISOString(),
            itemCount: Math.floor(Math.random() * 10)
          }
        };
      
      default:
        return {
          ok: false,
          status: 'failed',
          error: `Unknown operation: ${operation}`,
          errorType: 'permanent'
        };
    }
  }
}
