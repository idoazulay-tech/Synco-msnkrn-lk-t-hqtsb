/**
 * Parse Duration
 * Handles: דקות, שעות, רבע שעה, חצי שעה, ימים, שבועות, חודשים
 */

import { HEBREW_UNITS, HEBREW_TEENS, DURATION_UNITS_HE } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';
import { Duration } from '../types';

function parseHebrewNumber(text: string): number | null {
  if (/^\d+$/.test(text)) {
    return parseInt(text, 10);
  }
  
  if (HEBREW_UNITS[text] !== undefined) {
    return HEBREW_UNITS[text];
  }
  
  for (const [pattern, value] of Object.entries(HEBREW_TEENS)) {
    if (text === pattern) {
      return value;
    }
  }
  
  return null;
}

function minutesToISO(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  let iso = 'PT';
  if (days > 0) iso = `P${days}DT`;
  if (remainingHours > 0) iso += `${remainingHours}H`;
  if (mins > 0) iso += `${mins}M`;
  if (iso === 'PT') iso = 'PT0M';
  
  return iso;
}

export function parseDuration(text: string): Duration | null {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  const joined = normalized.join(' ');
  
  if (joined.includes('רבע שעה')) {
    return {
      type: 'duration',
      duration_minutes: 15,
      duration_iso: 'PT15M',
      confidence: 0.98,
      sourceText: text,
      reason: 'quarter_hour'
    };
  }
  
  if (joined.includes('חצי שעה')) {
    return {
      type: 'duration',
      duration_minutes: 30,
      duration_iso: 'PT30M',
      confidence: 0.98,
      sourceText: text,
      reason: 'half_hour'
    };
  }
  
  if (joined.includes('שעתיים')) {
    return {
      type: 'duration',
      duration_minutes: 120,
      duration_iso: 'PT2H',
      confidence: 0.98,
      sourceText: text,
      reason: 'two_hours'
    };
  }
  
  if (joined.includes('יומיים')) {
    return {
      type: 'duration',
      duration_minutes: 2880,
      duration_iso: 'P2D',
      confidence: 0.98,
      sourceText: text,
      reason: 'two_days'
    };
  }
  
  if (joined.includes('שבועיים')) {
    return {
      type: 'duration',
      duration_minutes: 20160,
      duration_iso: 'P14D',
      confidence: 0.98,
      sourceText: text,
      reason: 'two_weeks'
    };
  }
  
  if (joined.includes('חודשיים')) {
    return {
      type: 'duration',
      duration_minutes: 86400,
      duration_iso: 'P2M',
      confidence: 0.95,
      sourceText: text,
      reason: 'two_months'
    };
  }
  
  const durationPattern = /(\d+|אחת?|שתיים|שניים|שלוש[הא]?|ארבע[הא]?|חמי?ש[הא]?|שי?ש[הא]?|שבע[הא]?|שמונה|תשע[הא]?|עשר[הא]?)\s*(דקות?|שעות?|ימים?|שבועות?|חודשים?)/;
  
  const match = joined.match(durationPattern);
  if (match) {
    let num = parseHebrewNumber(match[1]);
    if (num === null) num = 1;
    
    const unit = match[2];
    let baseMinutes = 1;
    let reason = '';
    
    if (unit.includes('דק')) {
      baseMinutes = 1;
      reason = 'minutes';
    } else if (unit.includes('שע')) {
      baseMinutes = 60;
      reason = 'hours';
    } else if (unit.includes('יום') || unit.includes('ימים')) {
      baseMinutes = 1440;
      reason = 'days';
    } else if (unit.includes('שבוע')) {
      baseMinutes = 10080;
      reason = 'weeks';
    } else if (unit.includes('חודש')) {
      baseMinutes = 43200;
      reason = 'months';
    }
    
    const totalMinutes = num * baseMinutes;
    
    return {
      type: 'duration',
      duration_minutes: totalMinutes,
      duration_iso: minutesToISO(totalMinutes),
      confidence: 0.95,
      sourceText: text,
      reason: `${num}_${reason}`
    };
  }
  
  return null;
}
