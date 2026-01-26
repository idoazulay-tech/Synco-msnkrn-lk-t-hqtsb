/**
 * Parse Quarter/Half Time Expressions
 * Handles: ורבע, וחצי, רבע ל, חסר רבע, X ל (minutes to hour)
 */

import { HEBREW_UNITS, HEBREW_TEENS } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';

export interface QuarterHalfResult {
  hour: number;
  minute: number;
  confidence: number;
  reason: string;
  formatted: string;
  needsClarification?: boolean;
}

function getHourValue(word: string): number | null {
  if (HEBREW_UNITS[word] !== undefined) {
    const val = HEBREW_UNITS[word];
    if (val >= 1 && val <= 12) return val;
  }
  return null;
}

function getTwoWordHour(tokens: string[], startIdx: number): { hour: number; consumed: number } | null {
  if (startIdx + 1 >= tokens.length) return null;
  
  const twoWord = tokens[startIdx] + ' ' + tokens[startIdx + 1];
  if (HEBREW_TEENS[twoWord] !== undefined) {
    const hour = HEBREW_TEENS[twoWord];
    if (hour >= 1 && hour <= 12) {
      return { hour, consumed: 2 };
    }
  }
  return null;
}

function findHour(tokens: string[]): { hour: number; index: number; consumed: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    const twoWord = getTwoWordHour(tokens, i);
    if (twoWord) {
      return { hour: twoWord.hour, index: i, consumed: 2 };
    }
    
    const hour = getHourValue(tokens[i]);
    if (hour !== null) {
      return { hour, index: i, consumed: 1 };
    }
  }
  return null;
}

export function parseQuarterHalf(text: string): QuarterHalfResult | null {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  const joined = normalized.join(' ');
  
  const hourInfo = findHour(normalized);
  if (!hourInfo) return null;
  
  const { hour, index } = hourInfo;
  const afterHour = normalized.slice(index + hourInfo.consumed);
  const beforeHour = normalized.slice(0, index);
  
  if (afterHour.includes('ו') && afterHour.includes('רבע')) {
    return {
      hour,
      minute: 15,
      confidence: 0.95,
      reason: 'quarter_past',
      formatted: `${hour}:15`
    };
  }
  
  if (afterHour.includes('רבע') || joined.includes('ורבע')) {
    return {
      hour,
      minute: 15,
      confidence: 0.95,
      reason: 'quarter_past',
      formatted: `${hour}:15`
    };
  }
  
  if (afterHour.includes('ו') && afterHour.includes('חצי')) {
    return {
      hour,
      minute: 30,
      confidence: 0.95,
      reason: 'half_past',
      formatted: `${hour}:30`
    };
  }
  
  if (afterHour.includes('חצי') || joined.includes('וחצי')) {
    return {
      hour,
      minute: 30,
      confidence: 0.95,
      reason: 'half_past',
      formatted: `${hour}:30`
    };
  }
  
  if (beforeHour.includes('רבע') && (beforeHour.includes('ל') || normalized[index - 1] === 'ל')) {
    const prevHour = hour === 1 ? 12 : hour - 1;
    return {
      hour: prevHour,
      minute: 45,
      confidence: 0.95,
      reason: 'quarter_to',
      formatted: `${prevHour}:45`
    };
  }
  
  if (joined.includes('חסר רבע') || joined.includes('חסר') && joined.includes('רבע')) {
    const prevHour = hour === 1 ? 12 : hour - 1;
    return {
      hour: prevHour,
      minute: 45,
      confidence: 0.95,
      reason: 'minus_quarter',
      formatted: `${prevHour}:45`
    };
  }
  
  const minutesToPattern = /(\d+|חמש|עשר|עשרים|חמישה)\s*ל/;
  const minutesToMatch = joined.match(minutesToPattern);
  if (minutesToMatch && beforeHour.some(t => t === 'ל')) {
    let minutesTo = 0;
    const val = minutesToMatch[1];
    
    if (/^\d+$/.test(val)) {
      minutesTo = parseInt(val, 10);
    } else if (val === 'חמש' || val === 'חמישה') {
      minutesTo = 5;
    } else if (val === 'עשר') {
      minutesTo = 10;
    } else if (val === 'עשרים') {
      minutesTo = 20;
    }
    
    if (minutesTo > 0 && minutesTo <= 30) {
      const prevHour = hour === 1 ? 12 : hour - 1;
      const minute = 60 - minutesTo;
      return {
        hour: prevHour,
        minute,
        confidence: 0.9,
        reason: 'minutes_to',
        formatted: `${prevHour}:${minute.toString().padStart(2, '0')}`
      };
    }
  }
  
  return null;
}
