/**
 * Parse Day Parts for AM/PM Context
 * Handles: בבוקר, בערב, בצהריים, בלילה, לפנות בוקר
 */

import { DAY_PARTS } from '../dictionaries';
import { tokenize } from '../tokenizer';

export interface DayPartResult {
  dayPart: string;
  startHour: number;
  endHour: number;
  pmOffset: boolean;
  confidence: number;
}

export function parseDayParts(text: string): DayPartResult | null {
  const lowerText = text.toLowerCase();
  
  for (const [pattern, info] of Object.entries(DAY_PARTS)) {
    if (text.includes(pattern)) {
      return {
        dayPart: pattern,
        startHour: info.start,
        endHour: info.end,
        pmOffset: info.pmOffset,
        confidence: 0.95
      };
    }
  }
  
  if (lowerText.includes('am')) {
    return {
      dayPart: 'AM',
      startHour: 0,
      endHour: 12,
      pmOffset: false,
      confidence: 0.95
    };
  }
  
  if (lowerText.includes('pm')) {
    return {
      dayPart: 'PM',
      startHour: 12,
      endHour: 24,
      pmOffset: true,
      confidence: 0.95
    };
  }
  
  return null;
}

export function applyDayPartToHour(hour: number, dayPart: DayPartResult | null): number {
  if (!dayPart) return hour;
  
  if (hour >= 1 && hour <= 12) {
    if (dayPart.pmOffset && hour < 12) {
      if (dayPart.dayPart.includes('ערב') && hour >= 5 && hour <= 11) {
        return hour + 12;
      }
      if (dayPart.dayPart.includes('צהריים') && hour >= 1 && hour <= 2) {
        return hour + 12;
      }
      if (dayPart.dayPart.includes('אחר הצהריים') || dayPart.dayPart.includes('אחה"צ')) {
        if (hour >= 1 && hour <= 5) {
          return hour + 12;
        }
      }
      if (dayPart.dayPart.includes('לילה') && hour >= 8 && hour <= 11) {
        return hour + 12;
      }
      if (dayPart.dayPart === 'PM' && hour !== 12) {
        return hour + 12;
      }
    }
    
    if (!dayPart.pmOffset && hour === 12) {
      if (dayPart.dayPart.includes('בוקר') || dayPart.dayPart === 'AM') {
        return 0;
      }
    }
  }
  
  return hour;
}

export function inferDayPartFromHour(hour: number): DayPartResult {
  if (hour >= 5 && hour < 12) {
    return {
      dayPart: 'בוקר',
      startHour: 5,
      endHour: 12,
      pmOffset: false,
      confidence: 0.8
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      dayPart: 'צהריים/אחה"צ',
      startHour: 12,
      endHour: 17,
      pmOffset: true,
      confidence: 0.8
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      dayPart: 'ערב',
      startHour: 17,
      endHour: 21,
      pmOffset: true,
      confidence: 0.8
    };
  }
  return {
    dayPart: 'לילה',
    startHour: 21,
    endHour: 5,
    pmOffset: true,
    confidence: 0.8
  };
}
