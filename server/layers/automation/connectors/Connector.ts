// Layer 6: Automation Layer - Connector Interface

import type { OperationType, ConnectorResult, ProviderType } from '../types/automationTypes.js';
import type { IAutomationStore } from '../store/automationStoreTypes.js';

export interface IConnector {
  readonly name: ProviderType;
  
  validateIntegration(store: IAutomationStore): boolean;
  
  execute(
    operation: OperationType, 
    payload: any
  ): Promise<ConnectorResult>;
}
