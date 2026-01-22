// Layer 4: Task & Time Engine - Conflict Rules

import type { ScheduleBlock, Task } from '../types/taskTypes.js';
import type { ConflictInfo } from '../types/scheduleTypes.js';

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictInfo[];
  canResolve: boolean;
  suggestedAction: 'ask' | 'stop' | null;
  questionText: string | null;
}

export function detectOverlapConflicts(
  blocks: ScheduleBlock[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const sorted = [...blocks].sort((a, b) => 
    a.startTimeIso.localeCompare(b.startTimeIso)
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.endTimeIso > next.startTimeIso) {
      conflicts.push({
        type: 'overlap',
        entityId: next.refId || next.id,
        message: `חפיפה בין "${current.title}" ו-"${next.title}"`,
        suggestions: ['להזיז אחת מהמשימות', 'לקצר אחת מהמשימות']
      });
    }
  }

  return conflicts;
}

export function analyzeConflictSeverity(
  conflicts: ConflictInfo[],
  tasks: Task[]
): ConflictResult {
  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflicts: [],
      canResolve: true,
      suggestedAction: null,
      questionText: null
    };
  }

  // Check if any conflict involves a mustLock task
  const hasMustLockConflict = conflicts.some(c => {
    if (c.type === 'must_lock_conflict') return true;
    const task = tasks.find(t => t.id === c.entityId);
    return task?.mustLock === true;
  });

  if (hasMustLockConflict) {
    return {
      hasConflict: true,
      conflicts,
      canResolve: false,
      suggestedAction: 'stop',
      questionText: 'יש קונפליקט עם משימה קריטית. איזו משימה להזיז?'
    };
  }

  // Non-mustLock conflicts can be resolved with options
  return {
    hasConflict: true,
    conflicts,
    canResolve: true,
    suggestedAction: 'ask',
    questionText: 'יש התנגשות בלוח הזמנים. איך תרצה לפתור?'
  };
}

export function getConflictResolutionOptions(
  conflicts: ConflictInfo[],
  tasks: Task[]
): string[] {
  const options: string[] = [];
  const affectedIds = new Set(conflicts.map(c => c.entityId));
  
  // Find movable tasks
  const movableTasks = tasks.filter(t => 
    affectedIds.has(t.id) && !t.mustLock
  );

  if (movableTasks.length > 0) {
    for (const task of movableTasks.slice(0, 3)) {
      options.push(`להזיז את "${task.title}"`);
    }
  }

  // Add general options
  options.push('לקצר משימות');
  options.push('לבטל משימה אחת');

  // Never return more than 4 options
  return options.slice(0, 4);
}
