import type { Task, TaskType } from '../types/taskTypes.js';

function mapPriorityToUrgency(priority?: string | null): 'low' | 'medium' | 'high' {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'medium';
}

function mapStatus(status: string): 'pending' | 'done' | 'canceled' {
  if (status === 'completed' || status === 'done') return 'done';
  if (status === 'deleted' || status === 'canceled') return 'canceled';
  return 'pending';
}

function isActive(record: any): boolean {
  if (record.deletedAt) return false;
  const s = record.status || '';
  return !['completed', 'deleted', 'done', 'canceled'].includes(s);
}

export function adaptUserTaskToScheduleTask(record: any): Task | null {
  if (!isActive(record)) return null;

  const startTimeIso: string = record.startTime instanceof Date
    ? record.startTime.toISOString()
    : (record.startTime ?? '');

  const endTimeIso: string = record.endTime instanceof Date
    ? record.endTime.toISOString()
    : (record.endTime ?? '');

  const dateIso = startTimeIso
    ? startTimeIso.split('T')[0]
    : new Date().toISOString().split('T')[0];

  let durationMinutes = typeof record.duration === 'number' ? record.duration : 30;
  if (durationMinutes <= 0 && startTimeIso && endTimeIso) {
    durationMinutes = Math.round(
      (new Date(endTimeIso).getTime() - new Date(startTimeIso).getTime()) / 60000
    );
  }
  if (durationMinutes <= 0) durationMinutes = 30;

  const mustLock = record.flexibility === 'fixed';
  const urgency = mapPriorityToUrgency(record.priority);

  const scheduled = startTimeIso && endTimeIso
    ? { dateIso, startTimeIso, endTimeIso }
    : null;

  const createdAtIso = record.createdAt instanceof Date
    ? record.createdAt.toISOString()
    : (record.createdAt ?? new Date().toISOString());

  const updatedAtIso = record.updatedAt instanceof Date
    ? record.updatedAt.toISOString()
    : (record.updatedAt ?? new Date().toISOString());

  return {
    id: record.id,
    title: record.title,
    taskType: 'general' as TaskType,
    status: mapStatus(record.status),
    mustLock,
    urgency,
    durationMinutes,
    scheduled,
    dependencies: [],
    createdAtIso,
    updatedAtIso,
  };
}

export function adaptUserTasksToScheduleTasks(records: any[]): Task[] {
  return records
    .map(adaptUserTaskToScheduleTask)
    .filter((t): t is Task => t !== null);
}
