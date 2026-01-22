// Layer 4: Task & Time Engine - Task Types

export type TaskStatus = 'pending' | 'done' | 'canceled';
export type Urgency = 'low' | 'medium' | 'high';

export interface ScheduledTime {
  dateIso: string;
  startTimeIso: string;
  endTimeIso: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  mustLock: boolean;
  urgency: Urgency;
  durationMinutes: number;
  scheduled: ScheduledTime | null;
  dependencies: string[];
  createdAtIso: string;
  updatedAtIso: string;
}

export interface Event {
  id: string;
  title: string;
  people: string[];
  location: string;
  scheduled: ScheduledTime;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface Note {
  id: string;
  text: string;
  createdAtIso: string;
  tags: string[];
}

export type BlockType = 'task' | 'event' | 'buffer' | 'free';

export interface ScheduleBlock {
  id: string;
  type: BlockType;
  refId: string | null;
  title: string;
  startTimeIso: string;
  endTimeIso: string;
}

export interface CreateTaskPayload {
  title: string;
  durationMinutes?: number;
  urgency?: Urgency;
  mustLock?: boolean;
  scheduled?: ScheduledTime | null;
  dependencies?: string[];
}

export interface CreateEventPayload {
  title: string;
  people?: string[];
  location?: string;
  scheduled: ScheduledTime;
}

export interface ReschedulePayload {
  entityId: string;
  entityType: 'task' | 'event';
  newScheduled: ScheduledTime;
}

export interface CancelPayload {
  entityId: string;
  entityType: 'task' | 'event';
}

export interface LogNotePayload {
  text: string;
  tags?: string[];
}
