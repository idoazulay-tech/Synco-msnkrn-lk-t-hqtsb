// Layer 6: Automation Layer - Timeout Policies

import type { ProviderType, OperationType } from '../types/automationTypes.js';

export interface TimeoutConfig {
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

const TIMEOUT_CONFIGS: Record<ProviderType, Record<OperationType, TimeoutConfig>> = {
  mock: {
    create: { timeoutMs: 2000 },
    update: { timeoutMs: 2000 },
    delete: { timeoutMs: 2000 },
    sync: { timeoutMs: 5000 }
  },
  google_calendar: {
    create: { timeoutMs: 15000 },
    update: { timeoutMs: 15000 },
    delete: { timeoutMs: 10000 },
    sync: { timeoutMs: 30000 }
  }
};

export function getTimeout(provider: ProviderType, operation: OperationType): number {
  return TIMEOUT_CONFIGS[provider]?.[operation]?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}
