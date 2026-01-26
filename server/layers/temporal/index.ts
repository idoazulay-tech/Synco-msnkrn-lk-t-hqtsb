/**
 * MA Temporal Engine v1
 * Hebrew Temporal Parser - Main Orchestrator
 * 
 * Parses Hebrew text for temporal expressions and returns structured results
 */

import { 
  TemporalResult, TimePoint, DatePoint, Duration, Interval, 
  Recurrence, AmbiguousTime, ParseContext, FreeBusySlot,
  SchedulingRules, ScheduleSuggestion
} from './types';
import { tokenize, normalizeTokens, extractDigitalTime } from './tokenizer';
import { parseNumericTime } from './parsers/numericTime';
import { parseQuarterHalf } from './parsers/quarterHalf';
import { parseDayParts, applyDayPartToHour } from './parsers/dayParts';
import { parseRelativeDates } from './parsers/relativeDates';
import { parseWeekdays } from './parsers/weekdays';
import { parseDuration } from './parsers/duration';
import { parseIntervals } from './parsers/intervals';
import { parseRecurrence } from './parsers/recurrence';
import { parseAmbiguity } from './parsers/ambiguity';
import { format, parse, addMinutes, isWithinInterval, parseISO } from 'date-fns';

export * from './types';
export { tokenize, normalizeTokens } from './tokenizer';
export { parseNumericTime } from './parsers/numericTime';
export { parseQuarterHalf } from './parsers/quarterHalf';
export { parseDayParts, applyDayPartToHour } from './parsers/dayParts';
export { parseRelativeDates } from './parsers/relativeDates';
export { parseWeekdays } from './parsers/weekdays';
export { parseDuration } from './parsers/duration';
export { parseIntervals } from './parsers/intervals';
export { parseRecurrence } from './parsers/recurrence';
export { parseAmbiguity } from './parsers/ambiguity';

const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

export function parseTemporalHe(
  text: string, 
  now: Date = new Date(), 
  timezone: string = DEFAULT_TIMEZONE
): TemporalResult {
  const context: ParseContext = { now, timezone };
  
  const ambiguity = parseAmbiguity(text, now);
  if (ambiguity) {
    return ambiguity;
  }
  
  const recurrence = parseRecurrence(text, now);
  if (recurrence) {
    return recurrence;
  }
  
  const interval = parseIntervals(text, now);
  if (interval) {
    return interval;
  }
  
  const duration = parseDuration(text);
  if (duration) {
    return duration;
  }
  
  const dayPart = parseDayParts(text);
  const relativeDate = parseRelativeDates(text, now);
  const weekday = parseWeekdays(text, now);
  
  let dateStr = relativeDate?.date || weekday?.date;
  
  const digitalTime = extractDigitalTime(text);
  if (digitalTime) {
    let hour = applyDayPartToHour(digitalTime.hour, dayPart);
    const timeStr = `${hour.toString().padStart(2, '0')}:${digitalTime.minute.toString().padStart(2, '0')}`;
    
    return {
      type: 'timepoint',
      date: dateStr,
      time: timeStr,
      timezone,
      confidence: 0.95,
      sourceText: text,
      reason: 'digital_time'
    };
  }
  
  const quarterHalf = parseQuarterHalf(text);
  if (quarterHalf) {
    let hour = applyDayPartToHour(quarterHalf.hour, dayPart);
    const timeStr = `${hour.toString().padStart(2, '0')}:${quarterHalf.minute.toString().padStart(2, '0')}`;
    
    return {
      type: 'timepoint',
      date: dateStr,
      time: timeStr,
      timezone,
      confidence: quarterHalf.confidence,
      sourceText: text,
      reason: quarterHalf.reason
    };
  }
  
  const numericTime = parseNumericTime(text);
  if (numericTime.hour >= 0 && !numericTime.needsClarification) {
    let hour = applyDayPartToHour(numericTime.hour, dayPart);
    const timeStr = `${hour.toString().padStart(2, '0')}:${numericTime.minute.toString().padStart(2, '0')}`;
    
    return {
      type: 'timepoint',
      date: dateStr,
      time: timeStr,
      timezone,
      confidence: numericTime.confidence,
      sourceText: text,
      reason: numericTime.reason
    };
  }
  
  // Handle Hebrew word hours with ב prefix (e.g., "בשש", "בשמונה")
  const hebrewHourWithBet: Record<string, number> = {
    'באחת': 1, 'באחד': 1, 'בשתיים': 2, 'בשניים': 2, 'בשני': 2,
    'בשלוש': 3, 'בארבע': 4, 'בחמש': 5, 'בשש': 6, 'בשבע': 7,
    'בשמונה': 8, 'בתשע': 9, 'בעשר': 10, 'באחת עשרה': 11, 'בשתים עשרה': 12
  };
  
  for (const [word, hourVal] of Object.entries(hebrewHourWithBet)) {
    if (text.includes(word)) {
      let hour = applyDayPartToHour(hourVal, dayPart);
      return {
        type: 'timepoint',
        date: dateStr,
        time: `${hour.toString().padStart(2, '0')}:00`,
        timezone,
        confidence: dayPart ? 0.95 : 0.85,
        sourceText: text,
        reason: 'simple_hour'
      };
    }
  }

  const simpleHourMatch = text.match(/(?:ב-?)?(\d{1,2})(?:\s|$)/);
  if (simpleHourMatch) {
    let hour = parseInt(simpleHourMatch[1], 10);
    if (hour >= 1 && hour <= 24) {
      hour = hour === 24 ? 0 : hour;
      
      if (hour <= 12 && !dayPart) {
        return {
          type: 'timepoint',
          date: dateStr,
          time: `${hour.toString().padStart(2, '0')}:00`,
          timezone,
          confidence: 0.6,
          sourceText: text,
          reason: 'ambiguous_hour',
          needs_clarification: true,
          question: `${hour} בבוקר או ${hour} בערב?`
        };
      }
      
      hour = applyDayPartToHour(hour, dayPart);
      
      return {
        type: 'timepoint',
        date: dateStr,
        time: `${hour.toString().padStart(2, '0')}:00`,
        timezone,
        confidence: dayPart ? 0.9 : 0.7,
        sourceText: text,
        reason: 'simple_hour'
      };
    }
  }
  
  if (relativeDate || weekday) {
    const date = relativeDate?.date || weekday?.date || format(now, 'yyyy-MM-dd');
    return {
      type: 'datepoint',
      date,
      confidence: 0.95,
      sourceText: text,
      reason: relativeDate ? relativeDate.reason : weekday!.reason
    };
  }
  
  return {
    type: 'timepoint',
    time: '',
    timezone,
    confidence: 0,
    sourceText: text,
    reason: 'no_temporal_found',
    needs_clarification: true,
    question: 'לא הצלחתי להבין את הזמן. מתי בדיוק?'
  };
}

export function suggestScheduleSlots(
  temporalResult: TemporalResult,
  freeBusy: FreeBusySlot[],
  taskDurationMinutes: number,
  rules: SchedulingRules = {}
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  
  const sleepStart = rules.sleepStart ?? 23;
  const sleepEnd = rules.sleepEnd ?? 6;
  const minGap = rules.minGapMinutes ?? 15;
  
  let preferredWindows: { start: number; end: number }[] = [];
  let targetDate: string | undefined;
  
  if (temporalResult.type === 'ambiguous') {
    const hints = temporalResult.hints;
    if (hints.preferredWindows) {
      preferredWindows = hints.preferredWindows.map(w => ({
        start: w.startHour,
        end: w.endHour
      }));
    }
    targetDate = temporalResult.date;
  } else if (temporalResult.type === 'interval') {
    if (temporalResult.start && temporalResult.end) {
      const startTime = parseISO(temporalResult.start);
      const endTime = parseISO(temporalResult.end);
      preferredWindows = [{
        start: startTime.getHours(),
        end: endTime.getHours()
      }];
      targetDate = temporalResult.start.split('T')[0];
    }
  } else if (temporalResult.type === 'timepoint') {
    if (temporalResult.time) {
      const [hour] = temporalResult.time.split(':').map(Number);
      preferredWindows = [{ start: hour, end: hour + 2 }];
    }
    targetDate = temporalResult.date;
  } else if (temporalResult.type === 'datepoint') {
    targetDate = temporalResult.date;
    preferredWindows = [
      { start: 9, end: 12 },
      { start: 14, end: 17 }
    ];
  }
  
  if (preferredWindows.length === 0) {
    if (rules.preferMorning) {
      preferredWindows.push({ start: 8, end: 12 });
    }
    if (rules.preferAfternoon) {
      preferredWindows.push({ start: 13, end: 17 });
    }
    if (rules.preferEvening) {
      preferredWindows.push({ start: 18, end: 21 });
    }
    if (preferredWindows.length === 0) {
      preferredWindows = [{ start: 9, end: 18 }];
    }
  }
  
  const freeSlots = freeBusy.filter(slot => slot.status === 'free');
  
  for (const freeSlot of freeSlots) {
    const slotStart = parseISO(freeSlot.start);
    const slotEnd = parseISO(freeSlot.end);
    
    if (targetDate && !freeSlot.start.startsWith(targetDate)) {
      continue;
    }
    
    const slotStartHour = slotStart.getHours();
    if (slotStartHour >= sleepStart || slotStartHour < sleepEnd) {
      continue;
    }
    
    const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
    if (slotDuration < taskDurationMinutes + minGap) {
      continue;
    }
    
    for (const window of preferredWindows) {
      if (slotStartHour >= window.start && slotStartHour < window.end) {
        const taskEnd = addMinutes(slotStart, taskDurationMinutes);
        
        suggestions.push({
          start: format(slotStart, "yyyy-MM-dd'T'HH:mm"),
          end: format(taskEnd, "yyyy-MM-dd'T'HH:mm"),
          score: 0.9,
          reason: `פנוי ב${window.start}:00-${window.end}:00`
        });
      }
    }
    
    if (suggestions.length === 0) {
      const taskEnd = addMinutes(slotStart, taskDurationMinutes);
      suggestions.push({
        start: format(slotStart, "yyyy-MM-dd'T'HH:mm"),
        end: format(taskEnd, "yyyy-MM-dd'T'HH:mm"),
        score: 0.7,
        reason: 'חריץ פנוי'
      });
    }
  }
  
  suggestions.sort((a, b) => b.score - a.score);
  
  return suggestions.slice(0, 3);
}
