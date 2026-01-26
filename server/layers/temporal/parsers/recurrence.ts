/**
 * Parse Recurrence Patterns
 * Handles: כל יום, כל שבוע, כל יום שני, פעמיים בשבוע, etc.
 */

import { RECURRENCE_PATTERNS_HE, WEEKDAYS_HE } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';
import { Recurrence, RecurrencePattern } from '../types';

const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function findWeekdayInText(text: string): string[] {
  const found: string[] = [];
  
  for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
    if (text.includes(WEEKDAY_NAMES[i])) {
      found.push(WEEKDAY_CODES[i]);
    }
  }
  
  return found;
}

export function parseRecurrence(text: string, now: Date): Recurrence | null {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  const joined = normalized.join(' ');
  
  for (const [pattern, info] of Object.entries(RECURRENCE_PATTERNS_HE)) {
    if (text.includes(pattern)) {
      const recurrencePattern: RecurrencePattern = {
        freq: info.freq as 'daily' | 'weekly' | 'monthly',
        interval: info.interval
      };
      
      if (info.freq === 'weekly') {
        const weekdays = findWeekdayInText(text);
        if (weekdays.length > 0) {
          recurrencePattern.byDay = weekdays;
        }
      }
      
      return {
        type: 'recurrence',
        pattern: recurrencePattern,
        confidence: 0.9,
        sourceText: text,
        reason: `pattern_${pattern}`
      };
    }
  }
  
  const everyWeekdayPattern = /כל\s*(יום\s*)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/;
  const everyWeekdayMatch = text.match(everyWeekdayPattern);
  
  if (everyWeekdayMatch) {
    const weekdayName = everyWeekdayMatch[2];
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayName);
    
    if (weekdayIndex >= 0) {
      return {
        type: 'recurrence',
        pattern: {
          freq: 'weekly',
          interval: 1,
          byDay: [WEEKDAY_CODES[weekdayIndex]]
        },
        confidence: 0.95,
        sourceText: text,
        reason: `every_${weekdayName}`
      };
    }
  }
  
  const monthlyPattern = /כל\s*חודש\s*(?:ב|ב-?)?(\d{1,2})/;
  const monthlyMatch = text.match(monthlyPattern);
  
  if (monthlyMatch) {
    const dayOfMonth = parseInt(monthlyMatch[1], 10);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      return {
        type: 'recurrence',
        pattern: {
          freq: 'monthly',
          interval: 1,
          dayOfMonth
        },
        confidence: 0.95,
        sourceText: text,
        reason: `monthly_on_${dayOfMonth}`
      };
    }
  }
  
  const timesPerWeekPattern = /(\d+|שתי|שלוש|ארבע|חמש)\s*פעמים?\s*ב(שבוע|חודש)/;
  const timesMatch = text.match(timesPerWeekPattern);
  
  if (timesMatch) {
    let count = 2;
    const numStr = timesMatch[1];
    
    if (/^\d+$/.test(numStr)) {
      count = parseInt(numStr, 10);
    } else if (numStr === 'שתי') {
      count = 2;
    } else if (numStr === 'שלוש') {
      count = 3;
    } else if (numStr === 'ארבע') {
      count = 4;
    } else if (numStr === 'חמש') {
      count = 5;
    }
    
    const period = timesMatch[2];
    const freq = period === 'שבוע' ? 'weekly' : 'monthly';
    
    return {
      type: 'recurrence',
      pattern: {
        freq: freq as 'weekly' | 'monthly',
        interval: 1
      },
      confidence: 0.8,
      sourceText: text,
      reason: `${count}_times_per_${period}`,
      needs_clarification: true,
      question: `באילו ימים ספציפיים ב${period}?`
    };
  }
  
  return null;
}
