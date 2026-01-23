// Layer 6: Automation Layer - Main Orchestrator
// READY FOR NEXT LAYER: Feedback & Review Layer

import type { ExternalAction, AutomationUIInstructions, Job } from './types/automationTypes.js';
import type { StoreState } from '../task/store/storeTypes.js';
import { getAutomationStore, resetAutomationStore } from './store/AutomationStore.js';
import { routeFromInternalAction, routeMultipleActions, getAutomationUIInstructions } from './router/actionRouter.js';
import { createExternalActionsFromState } from './router/externalActionMapper.js';
import { getRecentJobs, getJob } from './queue/jobQueue.js';
import { startWorker, stopWorker, isWorkerRunning, processNextJobNow } from './queue/worker.js';
import { resetRateLimiter } from './queue/rateLimiter.js';

export interface DecisionOutput {
  actionType: string;
  entityId?: string;
  payload?: any;
}

export interface AutomationResult {
  externalActionsPlanned: ExternalAction[];
  jobsCreated: number;
  jobIds: string[];
  needsUserAction: boolean;
  uiInstructions: AutomationUIInstructions;
}

export class AutomationLayer {
  private autoStartWorker: boolean;

  constructor(autoStartWorker: boolean = true) {
    this.autoStartWorker = autoStartWorker;
    if (autoStartWorker) {
      this.ensureWorkerRunning();
    }
  }

  private ensureWorkerRunning(): void {
    if (!isWorkerRunning()) {
      startWorker();
    }
  }

  planExternalActions(
    storeState: StoreState,
    decisionOutput: DecisionOutput
  ): ExternalAction[] {
    const { actionType, entityId, payload } = decisionOutput;
    
    if (!actionType || !entityId) {
      return [];
    }
    
    return createExternalActionsFromState(actionType, entityId, payload || {});
  }

  executeActions(actions: ExternalAction[]): AutomationResult {
    if (this.autoStartWorker) {
      this.ensureWorkerRunning();
    }
    
    const routeResult = routeMultipleActions(actions);
    
    return {
      externalActionsPlanned: actions,
      jobsCreated: routeResult.jobsCreated,
      jobIds: routeResult.jobIds,
      needsUserAction: routeResult.needsUserAction,
      uiInstructions: getAutomationUIInstructions()
    };
  }

  process(
    storeState: StoreState,
    decisionOutput: DecisionOutput
  ): AutomationResult {
    const actions = this.planExternalActions(storeState, decisionOutput);
    
    if (actions.length === 0) {
      return {
        externalActionsPlanned: [],
        jobsCreated: 0,
        jobIds: [],
        needsUserAction: false,
        uiInstructions: getAutomationUIInstructions()
      };
    }
    
    return this.executeActions(actions);
  }

  processFromAction(
    actionType: string,
    entityId: string,
    payload: any
  ): AutomationResult {
    const actions = createExternalActionsFromState(actionType, entityId, payload);
    return this.executeActions(actions);
  }

  getUIInstructions(): AutomationUIInstructions {
    return getAutomationUIInstructions();
  }

  getRecentJobs(limit: number = 20): Job[] {
    return getRecentJobs(limit);
  }

  getJobById(jobId: string): Job | null {
    return getJob(jobId);
  }

  async processNextJobSync(): Promise<Job | null> {
    return processNextJobNow();
  }

  startWorker(): void {
    startWorker();
  }

  stopWorker(): void {
    stopWorker();
  }

  isWorkerRunning(): boolean {
    return isWorkerRunning();
  }

  getStore() {
    return getAutomationStore();
  }

  reset(): void {
    stopWorker();
    resetAutomationStore();
    resetRateLimiter();
  }
}

// Singleton instance
let automationLayerInstance: AutomationLayer | null = null;

export function getAutomationLayer(): AutomationLayer {
  if (!automationLayerInstance) {
    automationLayerInstance = new AutomationLayer();
  }
  return automationLayerInstance;
}

export function resetAutomationLayer(): void {
  if (automationLayerInstance) {
    automationLayerInstance.reset();
    automationLayerInstance = null;
  }
}
