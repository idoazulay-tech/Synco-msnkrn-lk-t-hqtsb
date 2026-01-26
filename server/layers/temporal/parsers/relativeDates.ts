/**
 * Parse Relative Dates
 * Handles: היום, מחר, מחרתיים, אתמול, שלשום, בעוד X, תוך X
 */

import { RELATIVE_DATES_HE, HEBREW_UNITS, HEBREW_TEENS, DURATION_UNITS_HE } from '../dictionaries';
import { tokenize, normalizeTokens } from '../tokenizer';
import { format, addDays, addWeeks, addMonths, addHours, addMinutes } from 'date-fns';

export interface RelativeDateResult {
  date: string;
  daysOffset: number;
  confidence: number;
  reason: string;
  needsClarification?: boolean;
  question?: string;
}

function parseHebrewNumber(text: string): number | null {
  if (/^\d+$/.test(text)) {
    return parseInt(text, 10);
  }
  
  if (HEBREW_UNITS[text] !== undefined) {
    return HEBREW_UNITS[text];
  }
  
  for (const [pattern, value] of Object.entries(HEBREW_TEENS)) {
    if (text.includes(pattern)) {
      return value;
    }
  }
  
  return null;
}

export function parseRelativeDates(text: string, now: Date): RelativeDateResult | null {
  const tokens = tokenize(text);
  const normalized = normalizeTokens(tokens);
  const joined = normalized.join(' ');
  
  for (const [pattern, offset] of Object.entries(RELATIVE_DATES_HE)) {
    if (text.includes(pattern)) {
      const targetDate = addDays(now, offset);
      return {
        date: format(targetDate, 'yyyy-MM-dd'),
        daysOffset: offset,
        confidence: 0.98,
        reason: `relative_date_${pattern}`
      };
    }
  }
  
  const inXPattern = /(?:בעוד|תוך|עוד)\s+(\d+|אחד|אחת|שתיים|שניים|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|שבע|שבעה)\s*(ימים?|שבועות?|חודשים?|שעות?|דקות?)?/;
  const inXMatch = joined.match(inXPattern);
  
  if (inXMatch) {
    const numStr = inXMatch[1];
    const unit = inXMatch[2] || 'ימים';
    
    let num = parseHebrewNumber(numStr);
    if (num === null) num = 1;
    
    let targetDate = now;
    let reason = '';
    
    if (unit.includes('יום') || unit.includes('ימים')) {
      targetDate = addDays(now, num);
      reason = `in_${num}_days`;
    } else if (unit.includes('שבוע')) {
      targetDate = addWeeks(now, num);
      reason = `in_${num}_weeks`;
    } else if (unit.includes('חודש')) {
      targetDate = addMonths(now, num);
      reason = `in_${num}_months`;
    } else if (unit.includes('שעה') || unit.includes('שעות')) {
      targetDate = addHours(now, num);
      reason = `in_${num}_hours`;
    } else if (unit.includes('דקה') || unit.includes('דקות')) {
      targetDate = addMinutes(now, num);
      reason = `in_${num}_minutes`;
    }
    
    return {
      date: format(targetDate, 'yyyy-MM-dd'),
      daysOffset: Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      confidence: 0.9,
      reason
    };
  }
  
  return null;
}
