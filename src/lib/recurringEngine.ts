import { Task } from '@/types/task';
import { startOfDay, addDays, addMonths, addYears, differenceInMilliseconds, format, isBefore, isAfter, isSameDay } from 'date-fns';

export function isRecurringOccurrence(taskId: string): boolean {
  return taskId.includes('_occ_');
}

export function getMasterTaskId(taskId: string): string {
  const idx = taskId.indexOf('_occ_');
  return idx >= 0 ? taskId.substring(0, idx) : taskId;
}

export function expandRecurring(task: Task, rangeStart: Date, rangeEnd: Date): Task[] {
  if (!task.repeat) return [];

  const { frequency, interval, daysOfWeek, endType, endDate, endCount } = task.repeat;
  const masterStart = new Date(task.startTime);
  const masterEnd = new Date(task.endTime);
  const timeDelta = differenceInMilliseconds(masterEnd, masterStart);
  const anchorDay = startOfDay(masterStart);
  const hoursOffset = masterStart.getTime() - anchorDay.getTime();

  const occurrences: Task[] = [];
  let count = 0;
  let current = anchorDay;

  const effectiveEnd = endType === 'date' && endDate
    ? new Date(endDate)
    : addYears(rangeEnd, 2);

  const maxIterations = 1500;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    if (isAfter(current, effectiveEnd) || isAfter(current, rangeEnd)) break;
    if (endType === 'count' && endCount && count >= endCount) break;

    let shouldFire = false;

    if (frequency === 'daily') {
      shouldFire = true;
    } else if (frequency === 'weekly') {
      const dayOfWeek = current.getDay();
      if (daysOfWeek && daysOfWeek.length > 0) {
        shouldFire = daysOfWeek.includes(dayOfWeek);
      } else {
        shouldFire = dayOfWeek === anchorDay.getDay();
      }
    } else if (frequency === 'monthly') {
      shouldFire = current.getDate() === anchorDay.getDate();
    } else if (frequency === 'yearly') {
      shouldFire = current.getDate() === anchorDay.getDate() &&
                   current.getMonth() === anchorDay.getMonth();
    }

    if (shouldFire && !isBefore(current, anchorDay)) {
      count++;

      if (endType === 'count' && endCount && count > endCount) break;

      if (!isBefore(current, startOfDay(rangeStart)) || isSameDay(current, rangeStart)) {
        const occStart = new Date(current.getTime() + hoursOffset);
        const occEnd = new Date(occStart.getTime() + timeDelta);
        const dateKey = format(current, 'yyyy-MM-dd');

        if (!isSameDay(current, anchorDay)) {
          occurrences.push({
            ...task,
            id: `${task.id}_occ_${dateKey}`,
            startTime: occStart,
            endTime: occEnd,
          });
        }
      }
    }

    if (frequency === 'daily') {
      current = addDays(current, interval);
    } else if (frequency === 'weekly') {
      current = addDays(current, 1);
    } else if (frequency === 'monthly') {
      current = addDays(current, 1);
      if (current.getDate() === 1 && !isSameDay(current, anchorDay)) {
        const nextMonth = addMonths(startOfDay(new Date(current.getFullYear(), current.getMonth(), anchorDay.getDate() > 28 ? 28 : anchorDay.getDate())), 0);
        if (nextMonth > current) current = nextMonth;
      }
    } else if (frequency === 'yearly') {
      current = addDays(current, 1);
    }
  }

  return occurrences;
}

const DAY_NAMES_HE: Record<number, string> = {
  0: 'א',
  1: 'ב',
  2: 'ג',
  3: 'ד',
  4: 'ה',
  5: 'ו',
  6: 'ש',
};

const FREQ_NAMES_HE: Record<string, string> = {
  daily: 'כל יום',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
  yearly: 'כל שנה',
};

export function formatRecurringSummary(rule: import('@/types/task').RecurringRule): string {
  let summary = FREQ_NAMES_HE[rule.frequency] || rule.frequency;

  if (rule.interval > 1) {
    summary = `כל ${rule.interval} ${rule.frequency === 'daily' ? 'ימים' : rule.frequency === 'weekly' ? 'שבועות' : rule.frequency === 'monthly' ? 'חודשים' : 'שנים'}`;
  }

  if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const dayNames = rule.daysOfWeek
      .sort((a, b) => a - b)
      .map(d => DAY_NAMES_HE[d] || String(d));
    summary += ` — ${dayNames.join(', ')}`;
  }

  if (rule.endType === 'date' && rule.endDate) {
    summary += ` (עד ${rule.endDate})`;
  } else if (rule.endType === 'count' && rule.endCount) {
    summary += ` (${rule.endCount} פעמים)`;
  }

  return summary;
}
