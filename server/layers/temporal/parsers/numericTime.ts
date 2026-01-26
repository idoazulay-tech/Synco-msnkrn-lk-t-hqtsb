/**
 * Parse Numeric Time - Hebrew spoken times to H:MM
 * Builds on TIME_SPOKEN_HE_IL_TO_DIGITAL
 */

import { HEBREW_UNITS, HEBREW_TEENS, HEBREW_TENS, ROUND_HOUR_MARKERS } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';

export interface NumericTimeResult {
  hour: number;
  minute: number;
  confidence: number;
  reason: string;
  formatted: string;
  needsClarification?: boolean;
}

function heNumberToInt(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  
  const joined = tokens.join(' ');
  
  for (const [word, value] of Object.entries(HEBREW_TEENS)) {
    if (joined === word || joined.startsWith(word + ' ')) {
      return value;
    }
  }
  
  let tensValue = 0;
  let unitsValue = 0;
  let foundTens = false;
  let foundVav = false;
  let foundUnit = false;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (HEBREW_TENS[token] !== undefined && !foundTens) {
      tensValue = HEBREW_TENS[token];
      foundTens = true;
      continue;
    }
    
    if (token === 'ו' && foundTens && !foundVav) {
      foundVav = true;
      continue;
    }
    
    if (HEBREW_UNITS[token] !== undefined && !foundUnit) {
      unitsValue = HEBREW_UNITS[token];
      foundUnit = true;
      continue;
    }
  }
  
  if (foundTens) {
    return tensValue + unitsValue;
  }
  
  if (tokens.length === 1 && HEBREW_UNITS[tokens[0]] !== undefined) {
    return HEBREW_UNITS[tokens[0]];
  }
  
  if (tokens.length === 2 && tokens[0] === 'אפס') {
    const secondVal = HEBREW_UNITS[tokens[1]];
    if (secondVal !== undefined) {
      return secondVal;
    }
  }
  
  return null;
}

function parseHourFromTokens(tokens: string[]): { hour: number; consumedCount: number } | null {
  if (tokens.length === 0) return null;
  
  if (tokens.length >= 2) {
    const twoWord = tokens.slice(0, 2).join(' ');
    if (HEBREW_TEENS[twoWord] !== undefined) {
      const hour = HEBREW_TEENS[twoWord];
      if (hour >= 1 && hour <= 12) {
        return { hour, consumedCount: 2 };
      }
    }
  }
  
  const firstToken = tokens[0];
  if (HEBREW_UNITS[firstToken] !== undefined) {
    const hour = HEBREW_UNITS[firstToken];
    if (hour >= 1 && hour <= 12) {
      return { hour, consumedCount: 1 };
    }
  }
  
  return null;
}

function isRoundHour(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  
  const joined = tokens.join(' ');
  
  for (const marker of ROUND_HOUR_MARKERS) {
    if (joined.includes(marker)) return true;
  }
  
  if (tokens.length >= 2 && tokens[0] === 'אפס' && tokens[1] === 'אפס') {
    return true;
  }
  
  return false;
}

function formatTime(hour: number, minute: number): string {
  const minStr = minute.toString().padStart(2, '0');
  return `${hour}:${minStr}`;
}

export function parseNumericTime(text: string): NumericTimeResult {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  
  for (let startIdx = 0; startIdx < normalized.length; startIdx++) {
    const scanTokens = normalized.slice(startIdx);
    const hourResult = parseHourFromTokens(scanTokens);
    
    if (!hourResult) continue;
    
    const { hour, consumedCount } = hourResult;
    const remainingTokens = scanTokens.slice(consumedCount);
    
    if (remainingTokens.length === 0 || isRoundHour(remainingTokens)) {
      return {
        hour,
        minute: 0,
        confidence: 0.95,
        reason: 'round_hour',
        formatted: formatTime(hour, 0)
      };
    }
    
    const minuteTokens = normalizeTokens(remainingTokens);
    const minutes = heNumberToInt(minuteTokens);
    
    if (minutes === null) continue;
    
    if (minutes < 0 || minutes > 59) {
      return {
        hour,
        minute: minutes,
        confidence: 0.2,
        reason: 'minutes_out_of_range',
        formatted: '',
        needsClarification: true
      };
    }
    
    return {
      hour,
      minute: minutes,
      confidence: 0.95,
      reason: 'spoken_time_parsed',
      formatted: formatTime(hour, minutes)
    };
  }
  
  return {
    hour: -1,
    minute: -1,
    confidence: 0,
    reason: 'no_hour_found',
    formatted: '',
    needsClarification: true
  };
}
