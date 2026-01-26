/**
 * Hebrew Temporal Tokenizer
 * Tokenizes and normalizes Hebrew text for temporal parsing
 */

const PUNCTUATION = /[.,;:!?()\[\]{}"""''`]/g;
const MULTIPLE_SPACES = /\s+/g;

export function tokenize(text: string): string[] {
  let cleaned = text
    .replace(PUNCTUATION, ' ')
    .replace(MULTIPLE_SPACES, ' ')
    .trim();
  
  if (!cleaned) return [];
  
  return cleaned.split(' ').filter(t => t.length > 0);
}

export function normalizeTokens(tokens: string[]): string[] {
  const normalized: string[] = [];
  
  for (const token of tokens) {
    if (token.startsWith('ו') && token.length > 1) {
      const rest = token.slice(1);
      if (isHebrewNumber(rest) || isTimeWord(rest)) {
        normalized.push('ו');
        normalized.push(rest);
        continue;
      }
    }
    
    if (token.startsWith('ב') && token.length > 1) {
      const rest = token.slice(1);
      if (isHebrewNumber(rest) || isTimeWord(rest)) {
        normalized.push('ב');
        normalized.push(rest);
        continue;
      }
    }
    
    if (token.startsWith('ל') && token.length > 1) {
      const rest = token.slice(1);
      if (isHebrewNumber(rest)) {
        normalized.push('ל');
        normalized.push(rest);
        continue;
      }
    }
    
    if (token.startsWith('מ') && token.length > 1 && !token.startsWith('מחר')) {
      const rest = token.slice(1);
      if (isHebrewNumber(rest) || /^\d/.test(rest)) {
        normalized.push('מ');
        normalized.push(rest);
        continue;
      }
    }
    
    normalized.push(token);
  }
  
  return normalized;
}

function isHebrewNumber(word: string): boolean {
  const numbers = new Set([
    'אפס', 'אחת', 'אחד', 'שתיים', 'שניים', 'שני', 'שלוש', 'שלושה',
    'ארבע', 'ארבעה', 'חמש', 'חמישה', 'שש', 'שישה', 'שבע', 'שבעה',
    'שמונה', 'תשע', 'תשעה', 'עשר', 'עשרה', 'עשרים', 'שלושים',
    'ארבעים', 'חמישים'
  ]);
  return numbers.has(word);
}

function isTimeWord(word: string): boolean {
  const timeWords = new Set([
    'רבע', 'חצי', 'דקה', 'דקות', 'שעה', 'שעות', 'בוקר', 'ערב',
    'צהריים', 'לילה'
  ]);
  return timeWords.has(word);
}

export function extractDigitalTime(text: string): { hour: number; minute: number; matched: string } | null {
  const patterns = [
    /(\d{1,2}):(\d{2})/,
    /(\d{1,2})\.(\d{2})/,
    /(\d{1,2})\s*([ap]m)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;
      
      if (match[2] && /[ap]m/i.test(match[2])) {
        if (match[2].toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (match[2].toLowerCase() === 'am' && hour === 12) hour = 0;
      }
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute, matched: match[0] };
      }
    }
  }
  
  return null;
}

export function extractNumericHour(text: string): { hour: number; matched: string } | null {
  const match = text.match(/\b(\d{1,2})\b/);
  if (match) {
    const hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 24) {
      return { hour: hour === 24 ? 0 : hour, matched: match[0] };
    }
  }
  return null;
}
