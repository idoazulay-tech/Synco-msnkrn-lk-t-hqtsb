// Layer 4: Task & Time Engine - Schedule Types

import type { ScheduleBlock, Task, Event } from './taskTypes.js';

export interface ScheduleConfig {
  dayStartHour: number;
  dayEndHour: number;
  bufferMinutes: number;
  minTaskMinutes: number;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  dayStartHour: 8,
  dayEndHour: 22,
  bufferMinutes: 5,
  minTaskMinutes: 10
};

export interface TimeSlot {
  startTimeIso: string;
  endTimeIso: string;
  durationMinutes: number;
}

export interface ScheduleResult {
  success: boolean;
  blocks: ScheduleBlock[];
  unscheduledTasks: Task[];
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  type: 'overlap' | 'dependency' | 'no_space' | 'must_lock_conflict';
  entityId: string;
  message: string;
  suggestions: string[];
}

export interface ReshufflePlan {
  planId: 'A' | 'B';
  description: string;
  descriptionHe: string;
  changes: PlanChange[];
  affectedTasks: string[];
}

export interface PlanChange {
  entityId: string;
  action: 'shorten' | 'move' | 'postpone' | 'cancel';
  from: string;
  to: string;
}

export interface ReshuffleResult {
  needed: boolean;
  reason: string;
  planOptions: ReshufflePlan[];
  selectedPlan: 'A' | 'B' | null;
}
