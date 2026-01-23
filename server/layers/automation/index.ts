// Layer 6: Automation Layer - Main Entry Point

export * from './types/automationTypes.js';
export * from './store/automationStoreTypes.js';
export * from './store/AutomationStore.js';
export * from './AutomationLayer.js';
export * from './queue/jobQueue.js';
export * from './queue/worker.js';
export * from './queue/retryPolicy.js';
export * from './queue/rateLimiter.js';
export * from './queue/idempotency.js';
export * from './router/actionRouter.js';
export * from './router/externalActionMapper.js';
export * from './connectors/Connector.js';
export * from './connectors/mock/MockConnector.js';
export * from './connectors/google/GoogleCalendarConnector.js';
export * from './policies/timeouts.js';
export * from './policies/thresholds.js';

// READY FOR NEXT LAYER: Feedback & Review Layer
