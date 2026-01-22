// Layer 4: Task & Time Engine - Main Exports

export * from './types/taskTypes.js';
export * from './types/scheduleTypes.js';
export * from './store/storeTypes.js';
export { InMemoryStore, getStore, resetStore } from './store/InMemoryStore.js';
export { TaskTimeEngine } from './TaskTimeEngine.js';
export { buildSchedule, checkOverlap } from './planners/schedulePlanner.js';
export { createReshufflePlans, applyReshufflePlan } from './planners/reshufflePlanner.js';
export { shouldBeMustLock, detectUrgency, validateMustLockPlacement } from './rules/mustLockRules.js';
export { validateDependencies, validateDependencyOrder, topologicalSort } from './rules/dependencyRules.js';
export { detectOverlapConflicts, analyzeConflictSeverity, getConflictResolutionOptions } from './rules/conflictRules.js';

// Re-export legacy functions for compatibility
export { 
  estimateTaskDuration, 
  decomposeTask, 
  manageDayPlan, 
  TaskEngine 
} from './index.js';

// READY FOR NEXT LAYER: Learning Engine
