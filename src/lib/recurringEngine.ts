import { Task } from '@/types/task';
import { startOfDay, addDays, addWeeks, addMonths, addYears, differenceInMilliseconds, differenceInCalendarMonths, differenceInCalendarYears, format, isBefore, isAfter, isSameDay } from 'date-fns';

export function isRecurringOccurrence(taskId: string): boolean {
  return taskId.includes('_occ_');
}

export function getMasterTaskId(taskId: string): string {
  const idx = taskId.indexOf('_occ_');
  return idx >= 0 ? taskId.substring(0, idx) : taskId;
}

function generateCandidateDates(
  anchorDay: Date,
  frequency: string,
  interval: number,
  daysOfWeek: number[] | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  effectiveEnd: Date,
  maxCount: number | undefined,
): Date[] {
  const dates: Date[] = [];
  let count = 0;
  const maxIterations = 1500;
  let iterations = 0;

  if (frequency === 'daily') {
    let current = anchorDay;
    while (iterations < maxIterations) {
      iterations++;
      if (isAfter(current, effectiveEnd) || isAfter(current, rangeEnd)) break;
      if (maxCount && count >= maxCount) break;
      dates.push(current);
      count++;
      current = addDays(current, interval);
    }
  } else if (frequency === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      let weekStart = startOfDay(anchorDay);
      const anchorDayOfWeek = anchorDay.getDay();
      weekStart = addDays(weekStart, -anchorDayOfWeek);

      while (iterations < maxIterations) {
        iterations++;
        if (isAfter(weekStart, effectiveEnd) || isAfter(weekStart, rangeEnd)) break;
        if (maxCount && count >= maxCount) break;

        for (const dow of daysOfWeek.sort((a, b) => a - b)) {
          const candidate = addDays(weekStart, dow);
          if (isBefore(candidate, anchorDay)) continue;
          if (isAfter(candidate, effectiveEnd) || isAfter(candidate, rangeEnd)) break;
          if (maxCount && count >= maxCount) break;
          dates.push(candidate);
          count++;
        }

        weekStart = addWeeks(weekStart, interval);
      }
    } else {
      let current = anchorDay;
      while (iterations < maxIterations) {
        iterations++;
        if (isAfter(current, effectiveEnd) || isAfter(current, rangeEnd)) break;
        if (maxCount && count >= maxCount) break;
        dates.push(current);
        count++;
        current = addWeeks(current, interval);
      }
    }
  } else if (frequency === 'monthly') {
    const calMonthsApart = Math.max(0, differenceInCalendarMonths(rangeStart, anchorDay));
    const skipSteps = Math.max(0, Math.floor(calMonthsApart / interval) - 1);
    count = skipSteps;
    let current = addMonths(anchorDay, count * interval);

    while (iterations < maxIterations) {
      iterations++;
      if (isAfter(current, effectiveEnd) || isAfter(current, rangeEnd)) break;
      if (maxCount && count >= maxCount) break;
      dates.push(current);
      count++;
      current = addMonths(anchorDay, count * interval);
    }
  } else if (frequency === 'yearly') {
    const calYearsApart = Math.max(0, differenceInCalendarYears(rangeStart, anchorDay));
    const skipSteps = Math.max(0, Math.floor(calYearsApart / interval) - 1);
    count = skipSteps;
    let current = addYears(anchorDay, count * interval);

    while (iterations < maxIterations) {
      iterations++;
      if (isAfter(current, effectiveEnd) || isAfter(current, rangeEnd)) break;
      if (maxCount && count >= maxCount) break;
      dates.push(current);
      count++;
      current = addYears(anchorDay, count * interval);
    }
  }

  return dates;
}

export function expandRecurring(task: Task, rangeStart: Date, rangeEnd: Date): Task[] {
  if (!task.repeat) return [];

  const { frequency, interval, daysOfWeek, endType, endDate, endCount } = task.repeat;
  const masterStart = new Date(task.startTime);
  const masterEnd = new Date(task.endTime);
  const timeDelta = differenceInMilliseconds(masterEnd, masterStart);
  const anchorDay = startOfDay(masterStart);
  const hoursOffset = masterStart.getTime() - anchorDay.getTime();

  const effectiveEnd = endType === 'date' && endDate
    ? new Date(endDate)
    : addYears(rangeEnd, 2);

  const maxCount = endType === 'count' && endCount ? endCount : undefined;

  const candidates = generateCandidateDates(
    anchorDay, frequency, interval, daysOfWeek,
    startOfDay(rangeStart), rangeEnd, effectiveEnd, maxCount,
  );

  const dayStartMs = startOfDay(rangeStart).getTime();

  const occurrences: Task[] = [];

  for (const candidate of candidates) {
    if (isBefore(candidate, anchorDay)) continue;
    if (candidate.getTime() < dayStartMs) continue;

    const occStart = new Date(candidate.getTime() + hoursOffset);
    const occEnd = new Date(occStart.getTime() + timeDelta);
    const dateKey = format(candidate, 'yyyy-MM-dd');

    occurrences.push({
      ...task,
      id: `${task.id}_occ_${dateKey}`,
      startTime: occStart,
      endTime: occEnd,
    });
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
