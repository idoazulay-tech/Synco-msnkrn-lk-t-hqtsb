// Layer 4: Task & Time Engine - Schedule Planner

import type { Task, Event, ScheduleBlock } from '../types/taskTypes.js';
import type { 
  ScheduleConfig, 
  ScheduleResult, 
  ConflictInfo, 
  TimeSlot, 
  DEFAULT_SCHEDULE_CONFIG 
} from '../types/scheduleTypes.js';

function parseTimeToMinutes(timeIso: string): number {
  const date = new Date(timeIso);
  return date.getHours() * 60 + date.getMinutes();
}

function addMinutesToIso(baseIso: string, minutes: number): string {
  const date = new Date(baseIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function getDatePart(isoString: string): string {
  return isoString.split('T')[0];
}

function createTimeIso(dateIso: string, hour: number, minute: number = 0): string {
  return `${dateIso}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000Z`;
}

function findFreeSlots(
  blocks: ScheduleBlock[],
  dateIso: string,
  config: ScheduleConfig
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayStart = createTimeIso(dateIso, config.dayStartHour);
  const dayEnd = createTimeIso(dateIso, config.dayEndHour);
  
  if (blocks.length === 0) {
    const duration = (config.dayEndHour - config.dayStartHour) * 60;
    slots.push({
      startTimeIso: dayStart,
      endTimeIso: dayEnd,
      durationMinutes: duration
    });
    return slots;
  }

  const sortedBlocks = [...blocks].sort((a, b) => 
    a.startTimeIso.localeCompare(b.startTimeIso)
  );

  // Gap before first block
  if (sortedBlocks[0].startTimeIso > dayStart) {
    const start = parseTimeToMinutes(dayStart);
    const end = parseTimeToMinutes(sortedBlocks[0].startTimeIso);
    if (end > start) {
      slots.push({
        startTimeIso: dayStart,
        endTimeIso: sortedBlocks[0].startTimeIso,
        durationMinutes: end - start
      });
    }
  }

  // Gaps between blocks
  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const currentEnd = sortedBlocks[i].endTimeIso;
    const nextStart = sortedBlocks[i + 1].startTimeIso;
    const gapStart = parseTimeToMinutes(currentEnd);
    const gapEnd = parseTimeToMinutes(nextStart);
    
    if (gapEnd > gapStart) {
      slots.push({
        startTimeIso: currentEnd,
        endTimeIso: nextStart,
        durationMinutes: gapEnd - gapStart
      });
    }
  }

  // Gap after last block
  const lastBlock = sortedBlocks[sortedBlocks.length - 1];
  if (lastBlock.endTimeIso < dayEnd) {
    const start = parseTimeToMinutes(lastBlock.endTimeIso);
    const end = parseTimeToMinutes(dayEnd);
    if (end > start) {
      slots.push({
        startTimeIso: lastBlock.endTimeIso,
        endTimeIso: dayEnd,
        durationMinutes: end - start
      });
    }
  }

  return slots;
}

function prioritizeTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // mustLock first
    if (a.mustLock !== b.mustLock) {
      return a.mustLock ? -1 : 1;
    }
    // Then by urgency
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (a.urgency !== b.urgency) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    // Then by dependencies (tasks with no deps first)
    return a.dependencies.length - b.dependencies.length;
  });
}

function checkDependencies(task: Task, scheduledIds: Set<string>): boolean {
  return task.dependencies.every(depId => scheduledIds.has(depId));
}

export function buildSchedule(
  dateIso: string,
  tasks: Task[],
  events: Event[],
  config: ScheduleConfig = {
    dayStartHour: 8,
    dayEndHour: 22,
    bufferMinutes: 5,
    minTaskMinutes: 10
  }
): ScheduleResult {
  const blocks: ScheduleBlock[] = [];
  const conflicts: ConflictInfo[] = [];
  const scheduledIds = new Set<string>();
  const unscheduledTasks: Task[] = [];

  // First, place all events as fixed blocks
  for (const event of events) {
    if (getDatePart(event.scheduled.startTimeIso) === dateIso) {
      blocks.push({
        id: `block-${event.id}`,
        type: 'event',
        refId: event.id,
        title: event.title,
        startTimeIso: event.scheduled.startTimeIso,
        endTimeIso: event.scheduled.endTimeIso
      });
    }
  }

  // Place pre-scheduled tasks
  const preScheduledTasks = tasks.filter(t => 
    t.scheduled && 
    getDatePart(t.scheduled.startTimeIso) === dateIso &&
    t.status === 'pending'
  );

  for (const task of preScheduledTasks) {
    if (task.scheduled) {
      blocks.push({
        id: `block-${task.id}`,
        type: 'task',
        refId: task.id,
        title: task.title,
        startTimeIso: task.scheduled.startTimeIso,
        endTimeIso: task.scheduled.endTimeIso
      });
      scheduledIds.add(task.id);
    }
  }

  // Get unscheduled pending tasks
  const pendingTasks = tasks.filter(t => 
    !t.scheduled && t.status === 'pending'
  );
  const prioritized = prioritizeTasks(pendingTasks);

  // Try to schedule each task
  for (const task of prioritized) {
    // Check dependencies
    if (!checkDependencies(task, scheduledIds)) {
      const missingDeps = task.dependencies.filter(d => !scheduledIds.has(d));
      conflicts.push({
        type: 'dependency',
        entityId: task.id,
        message: `משימה "${task.title}" תלויה במשימות שעדיין לא תוזמנו`,
        suggestions: ['לתזמן את המשימות התלויות קודם']
      });
      unscheduledTasks.push(task);
      continue;
    }

    // Find a slot
    const freeSlots = findFreeSlots(blocks, dateIso, config);
    const neededMinutes = task.durationMinutes + config.bufferMinutes;
    
    const suitableSlot = freeSlots.find(slot => 
      slot.durationMinutes >= neededMinutes
    );

    if (suitableSlot) {
      const endTime = addMinutesToIso(suitableSlot.startTimeIso, task.durationMinutes);
      blocks.push({
        id: `block-${task.id}`,
        type: 'task',
        refId: task.id,
        title: task.title,
        startTimeIso: suitableSlot.startTimeIso,
        endTimeIso: endTime
      });
      scheduledIds.add(task.id);

      // Add buffer block if needed
      if (config.bufferMinutes > 0) {
        blocks.push({
          id: `buffer-${task.id}`,
          type: 'buffer',
          refId: null,
          title: 'הפסקה',
          startTimeIso: endTime,
          endTimeIso: addMinutesToIso(endTime, config.bufferMinutes)
        });
      }
    } else {
      if (task.mustLock) {
        conflicts.push({
          type: 'must_lock_conflict',
          entityId: task.id,
          message: `משימה קריטית "${task.title}" לא יכולה להיכנס ללוח הזמנים`,
          suggestions: ['להזיז משימות אחרות', 'לקצר משימות קיימות']
        });
      } else {
        conflicts.push({
          type: 'no_space',
          entityId: task.id,
          message: `אין מקום למשימה "${task.title}"`,
          suggestions: ['לדחות ליום אחר', 'לקצר את המשימה']
        });
      }
      unscheduledTasks.push(task);
    }
  }

  // Sort blocks by time
  blocks.sort((a, b) => a.startTimeIso.localeCompare(b.startTimeIso));

  return {
    success: conflicts.length === 0,
    blocks,
    unscheduledTasks,
    conflicts
  };
}

export function checkOverlap(
  blocks: ScheduleBlock[],
  newStart: string,
  newEnd: string
): ScheduleBlock | null {
  for (const block of blocks) {
    if (newStart < block.endTimeIso && newEnd > block.startTimeIso) {
      return block;
    }
  }
  return null;
}
