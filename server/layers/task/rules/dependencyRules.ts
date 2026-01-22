// Layer 4: Task & Time Engine - Dependency Rules

import type { Task, ScheduleBlock } from '../types/taskTypes.js';

export interface DependencyValidation {
  valid: boolean;
  message: string;
  missingDeps: string[];
}

export function validateDependencies(
  task: Task,
  scheduledTaskIds: Set<string>,
  allTasks: Task[]
): DependencyValidation {
  if (task.dependencies.length === 0) {
    return { valid: true, message: '', missingDeps: [] };
  }

  const missingDeps: string[] = [];
  
  for (const depId of task.dependencies) {
    if (!scheduledTaskIds.has(depId)) {
      missingDeps.push(depId);
    }
  }

  if (missingDeps.length > 0) {
    const missingNames = missingDeps
      .map(id => allTasks.find(t => t.id === id)?.title || id)
      .join(', ');
    
    return {
      valid: false,
      message: `משימה "${task.title}" תלויה ב: ${missingNames}`,
      missingDeps
    };
  }

  return { valid: true, message: '', missingDeps: [] };
}

export function validateDependencyOrder(
  task: Task,
  taskBlock: ScheduleBlock,
  blocks: ScheduleBlock[],
  allTasks: Task[]
): DependencyValidation {
  if (task.dependencies.length === 0) {
    return { valid: true, message: '', missingDeps: [] };
  }

  const violations: string[] = [];
  
  for (const depId of task.dependencies) {
    const depBlock = blocks.find(b => b.refId === depId);
    if (!depBlock) continue;
    
    // Task must start after dependency ends
    if (taskBlock.startTimeIso < depBlock.endTimeIso) {
      const depTask = allTasks.find(t => t.id === depId);
      violations.push(depTask?.title || depId);
    }
  }

  if (violations.length > 0) {
    return {
      valid: false,
      message: `משימה "${task.title}" חייבת להתחיל אחרי: ${violations.join(', ')}`,
      missingDeps: violations
    };
  }

  return { valid: true, message: '', missingDeps: [] };
}

export function buildDependencyGraph(
  tasks: Task[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  for (const task of tasks) {
    graph.set(task.id, task.dependencies);
  }
  
  return graph;
}

export function topologicalSort(tasks: Task[]): Task[] {
  const graph = buildDependencyGraph(tasks);
  const visited = new Set<string>();
  const result: Task[] = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const deps = graph.get(id) || [];
    for (const dep of deps) {
      visit(dep);
    }
    
    const task = taskMap.get(id);
    if (task) {
      result.push(task);
    }
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}
