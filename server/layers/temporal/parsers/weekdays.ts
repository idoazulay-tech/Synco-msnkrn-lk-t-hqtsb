/**
 * Parse Weekdays
 * Handles: יום ראשון to שבת, abbreviations, הקרוב/הבא/הזה
 */

import { WEEKDAYS_HE } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';
import { format, addDays, getDay } from 'date-fns';

export interface WeekdayResult {
  date: string;
  weekday: number;
  weekdayName: string;
  confidence: number;
  reason: string;
  needsClarification?: boolean;
}

const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function findWeekday(text: string): { weekday: number; name: string } | null {
  for (const name of WEEKDAY_NAMES) {
    if (text.includes(name)) {
      return { weekday: WEEKDAYS_HE[name], name };
    }
  }
  
  const abbrevMatch = text.match(/יום\s*([א-ו])'?/);
  if (abbrevMatch) {
    const letter = abbrevMatch[1];
    const abbrev = `${letter}'`;
    if (WEEKDAYS_HE[abbrev] !== undefined) {
      return { weekday: WEEKDAYS_HE[abbrev], name: WEEKDAY_NAMES[WEEKDAYS_HE[abbrev]] };
    }
    if (WEEKDAYS_HE[letter] !== undefined) {
      return { weekday: WEEKDAYS_HE[letter], name: WEEKDAY_NAMES[WEEKDAYS_HE[letter]] };
    }
  }
  
  const standaloneAbbrev = text.match(/(?:^|\s)([א-ו])'(?:\s|$)/);
  if (standaloneAbbrev) {
    const letter = standaloneAbbrev[1];
    const abbrev = `${letter}'`;
    if (WEEKDAYS_HE[abbrev] !== undefined) {
      return { weekday: WEEKDAYS_HE[abbrev], name: WEEKDAY_NAMES[WEEKDAYS_HE[abbrev]] };
    }
  }
  
  return null;
}

function getNextWeekday(now: Date, targetWeekday: number, modifier: 'next' | 'this' | 'closest'): Date {
  const currentWeekday = getDay(now);
  
  let daysToAdd = targetWeekday - currentWeekday;
  
  if (modifier === 'this') {
    if (daysToAdd < 0) {
      daysToAdd += 7;
    } else if (daysToAdd === 0) {
      return now;
    }
  } else if (modifier === 'next') {
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
  } else {
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
  }
  
  return addDays(now, daysToAdd);
}

export function parseWeekdays(text: string, now: Date): WeekdayResult | null {
  const weekdayInfo = findWeekday(text);
  if (!weekdayInfo) return null;
  
  const { weekday, name } = weekdayInfo;
  
  let modifier: 'next' | 'this' | 'closest' = 'closest';
  
  if (text.includes('הבא') || text.includes('הקרוב')) {
    modifier = 'next';
  } else if (text.includes('הזה')) {
    modifier = 'this';
  }
  
  const targetDate = getNextWeekday(now, weekday, modifier);
  
  return {
    date: format(targetDate, 'yyyy-MM-dd'),
    weekday,
    weekdayName: name,
    confidence: 0.95,
    reason: `weekday_${name}_${modifier}`
  };
}
