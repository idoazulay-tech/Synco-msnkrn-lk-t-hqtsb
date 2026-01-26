/**
 * Parse Intervals/Ranges
 * Handles: מ...עד, בין...ל, time ranges with optional dates
 */

import { tokenize, normalizeTokens, extractDigitalTime } from '../tokenizer';
import { parseNumericTime } from './numericTime';
import { parseDayParts, applyDayPartToHour } from './dayParts';
import { parseRelativeDates } from './relativeDates';
import { Interval } from '../types';
import { format } from 'date-fns';

function parseTimeValue(text: string, dayPartContext: ReturnType<typeof parseDayParts>): { hour: number; minute: number } | null {
  const digital = extractDigitalTime(text);
  if (digital) {
    return { hour: digital.hour, minute: digital.minute };
  }
  
  const numMatch = text.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    let hour = parseInt(numMatch[1], 10);
    if (hour >= 1 && hour <= 24) {
      hour = hour === 24 ? 0 : hour;
      hour = applyDayPartToHour(hour, dayPartContext);
      return { hour, minute: 0 };
    }
  }
  
  const spokenTime = parseNumericTime(text);
  if (spokenTime.hour >= 0) {
    const hour = applyDayPartToHour(spokenTime.hour, dayPartContext);
    return { hour, minute: spokenTime.minute };
  }
  
  return null;
}

export function parseIntervals(text: string, now: Date): Interval | null {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  const joined = text;
  
  const dayPart = parseDayParts(text);
  const dateResult = parseRelativeDates(text, now);
  const dateStr = dateResult?.date || format(now, 'yyyy-MM-dd');
  
  const fromToPattern = /(?:מ|מ-?|משעה)\s*(\d{1,2}(?::\d{2})?)\s*(?:עד|ל-?)\s*(\d{1,2}(?::\d{2})?)/;
  const fromToMatch = joined.match(fromToPattern);
  
  if (fromToMatch) {
    const startTime = parseTimeValue(fromToMatch[1], dayPart);
    const endTime = parseTimeValue(fromToMatch[2], dayPart);
    
    if (startTime && endTime) {
      const startStr = `${dateStr}T${startTime.hour.toString().padStart(2, '0')}:${startTime.minute.toString().padStart(2, '0')}`;
      const endStr = `${dateStr}T${endTime.hour.toString().padStart(2, '0')}:${endTime.minute.toString().padStart(2, '0')}`;
      
      return {
        type: 'interval',
        start: startStr,
        end: endStr,
        window: 'tight',
        confidence: 0.95,
        sourceText: text,
        reason: 'from_to_range'
      };
    }
  }
  
  const betweenPattern = /בין\s*(\d{1,2}(?::\d{2})?)\s*(?:ל|ל-?)\s*(\d{1,2}(?::\d{2})?)/;
  const betweenMatch = joined.match(betweenPattern);
  
  if (betweenMatch) {
    const startTime = parseTimeValue(betweenMatch[1], dayPart);
    const endTime = parseTimeValue(betweenMatch[2], dayPart);
    
    if (startTime && endTime) {
      const startStr = `${dateStr}T${startTime.hour.toString().padStart(2, '0')}:${startTime.minute.toString().padStart(2, '0')}`;
      const endStr = `${dateStr}T${endTime.hour.toString().padStart(2, '0')}:${endTime.minute.toString().padStart(2, '0')}`;
      
      return {
        type: 'interval',
        start: startStr,
        end: endStr,
        window: 'medium',
        confidence: 0.9,
        sourceText: text,
        reason: 'between_range'
      };
    }
  }
  
  const spokenFromTo = /מ\s*(שמונה|תשע|עשר|אחת עשרה|שתים עשרה|[א-ת]+)\s*(?:עד|ל)\s*(שמונה|תשע|עשר|אחת עשרה|שתים עשרה|[א-ת]+)/;
  const spokenMatch = joined.match(spokenFromTo);
  
  if (spokenMatch) {
    const startSpoken = parseNumericTime(spokenMatch[1]);
    const endSpoken = parseNumericTime(spokenMatch[2]);
    
    if (startSpoken.hour >= 0 && endSpoken.hour >= 0) {
      let startHour = applyDayPartToHour(startSpoken.hour, dayPart);
      let endHour = applyDayPartToHour(endSpoken.hour, dayPart);
      
      const startStr = `${dateStr}T${startHour.toString().padStart(2, '0')}:${startSpoken.minute.toString().padStart(2, '0')}`;
      const endStr = `${dateStr}T${endHour.toString().padStart(2, '0')}:${endSpoken.minute.toString().padStart(2, '0')}`;
      
      return {
        type: 'interval',
        start: startStr,
        end: endStr,
        window: 'tight',
        confidence: 0.9,
        sourceText: text,
        reason: 'spoken_range'
      };
    }
  }
  
  return null;
}
