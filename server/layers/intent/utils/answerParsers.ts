// PATCH 1: Answer Parsers for follow-up responses
// Parses short answers like "כן", "לא", "מחר", "2", "20 דקות" based on lastQuestionContext

import type { LastQuestionContext, TargetField } from '../types/contextTypes.js';

export interface ParsedTimeEntity {
  raw: string;
  iso: string;
}

export interface ParsedDateEntity {
  raw: string;
  iso: string;
}

export interface ParsedDurationEntity {
  raw: string;
  minutes: number;
}

export interface ParsedEntities {
  time?: ParsedTimeEntity;
  date?: ParsedDateEntity;
  duration?: ParsedDurationEntity;
}

export interface ParsedAnswer {
  partialEntities: ParsedEntities;
  isValidAnswer: boolean;
  parsedValue: string | number | boolean | null;
  needsClarification: boolean;
}

const HEBREW_YES = ['כן', 'בטח', 'נכון', 'כמובן', 'אכן', 'בסדר', 'אוקי', 'ok', 'yes'];
const HEBREW_NO = ['לא', 'ממש לא', 'לא עכשיו', 'אולי אחכ', 'no'];
const HEBREW_TOMORROW = ['מחר'];
const HEBREW_TODAY = ['היום'];
const HEBREW_DAY_AFTER = ['מחרתיים'];

const PLAN_A_ANSWERS = ['a', 'א', '1', 'תכנית 1', 'תכנית א', 'אפשרות 1', 'plan a'];
const PLAN_B_ANSWERS = ['b', 'ב', '2', 'תכנית 2', 'תכנית ב', 'אפשרות 2', 'plan b'];

export function parseAnswerByContext(
  answerText: string,
  context: LastQuestionContext | null
): ParsedAnswer {
  const result: ParsedAnswer = {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: false
  };

  if (!context) {
    return result;
  }

  const normalizedAnswer = answerText.trim().toLowerCase();
  const targetField: TargetField = context.targetField;

  // Handle confirm separately since it's not in TargetField
  if (targetField === 'unknown' && context.expectedAnswerType === 'confirm') {
    return parseConfirmAnswer(normalizedAnswer);
  }

  switch (targetField) {
    
    case 'time':
      return parseTimeAnswer(normalizedAnswer, answerText);
    
    case 'date':
      return parseDateAnswer(normalizedAnswer, answerText);
    
    case 'duration':
      return parseDurationAnswer(normalizedAnswer, answerText);
    
    case 'plan_choice':
      return parsePlanChoiceAnswer(normalizedAnswer);
    
    case 'scope':
    case 'targetCancel':
    case 'clarifyIntent':
      return parseChoiceAnswer(normalizedAnswer, context.options || []);
    
    default:
      return result;
  }
}

function parseConfirmAnswer(answer: string): ParsedAnswer {
  if (HEBREW_YES.some(y => answer.includes(y))) {
    return {
      partialEntities: {},
      isValidAnswer: true,
      parsedValue: true,
      needsClarification: false
    };
  }
  
  if (HEBREW_NO.some(n => answer.includes(n))) {
    return {
      partialEntities: {},
      isValidAnswer: true,
      parsedValue: false,
      needsClarification: false
    };
  }
  
  return {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: true
  };
}

function parseTimeAnswer(normalizedAnswer: string, rawAnswer: string): ParsedAnswer {
  const result: ParsedAnswer = {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: false
  };

  // Try to parse HH:MM format
  const timeMatch = rawAnswer.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const timeIso = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      result.partialEntities.time = { raw: rawAnswer, iso: timeIso };
      result.isValidAnswer = true;
      result.parsedValue = timeIso;
      return result;
    }
  }

  // Try to parse single number (e.g., "2" meaning 2:00)
  const numberMatch = rawAnswer.match(/^(\d{1,2})$/);
  if (numberMatch) {
    const hours = parseInt(numberMatch[1], 10);
    if (hours >= 0 && hours < 24) {
      // Check for AM/PM hints
      if (normalizedAnswer.includes('בוקר') || normalizedAnswer.includes('am')) {
        const timeIso = `${hours.toString().padStart(2, '0')}:00`;
        result.partialEntities.time = { raw: rawAnswer, iso: timeIso };
        result.isValidAnswer = true;
        result.parsedValue = timeIso;
      } else if (normalizedAnswer.includes('צהריים') || normalizedAnswer.includes('אחהצ') || 
                 normalizedAnswer.includes('ערב') || normalizedAnswer.includes('pm')) {
        const adjustedHours = hours < 12 ? hours + 12 : hours;
        const timeIso = `${adjustedHours.toString().padStart(2, '0')}:00`;
        result.partialEntities.time = { raw: rawAnswer, iso: timeIso };
        result.isValidAnswer = true;
        result.parsedValue = timeIso;
      } else {
        // Ambiguous - need clarification but still valid as answer
        result.partialEntities.time = { raw: rawAnswer, iso: '' };
        result.isValidAnswer = true;
        result.parsedValue = hours;
        result.needsClarification = true;
      }
      return result;
    }
  }

  return result;
}

function parseDateAnswer(normalizedAnswer: string, rawAnswer: string): ParsedAnswer {
  const result: ParsedAnswer = {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: false
  };

  const today = new Date();
  
  if (HEBREW_TODAY.some(d => normalizedAnswer.includes(d))) {
    const dateIso = today.toISOString().split('T')[0];
    result.partialEntities.date = { raw: rawAnswer, iso: dateIso };
    result.isValidAnswer = true;
    result.parsedValue = dateIso;
    return result;
  }
  
  if (HEBREW_TOMORROW.some(d => normalizedAnswer.includes(d))) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateIso = tomorrow.toISOString().split('T')[0];
    result.partialEntities.date = { raw: rawAnswer, iso: dateIso };
    result.isValidAnswer = true;
    result.parsedValue = dateIso;
    return result;
  }
  
  if (HEBREW_DAY_AFTER.some(d => normalizedAnswer.includes(d))) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dateIso = dayAfter.toISOString().split('T')[0];
    result.partialEntities.date = { raw: rawAnswer, iso: dateIso };
    result.isValidAnswer = true;
    result.parsedValue = dateIso;
    return result;
  }

  return result;
}

function parseDurationAnswer(normalizedAnswer: string, rawAnswer: string): ParsedAnswer {
  const result: ParsedAnswer = {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: false
  };

  // Parse "X דקות"
  const minutesMatch = rawAnswer.match(/(\d+)\s*דקות?/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10);
    result.partialEntities.duration = { raw: rawAnswer, minutes };
    result.isValidAnswer = true;
    result.parsedValue = minutes;
    return result;
  }

  // Parse "חצי שעה"
  if (normalizedAnswer.includes('חצי שעה')) {
    result.partialEntities.duration = { raw: rawAnswer, minutes: 30 };
    result.isValidAnswer = true;
    result.parsedValue = 30;
    return result;
  }

  // Parse "שעה" or "שעה אחת"
  if (normalizedAnswer.match(/^שעה(\s+אחת)?$/)) {
    result.partialEntities.duration = { raw: rawAnswer, minutes: 60 };
    result.isValidAnswer = true;
    result.parsedValue = 60;
    return result;
  }

  // Parse "שעתיים"
  if (normalizedAnswer.includes('שעתיים')) {
    result.partialEntities.duration = { raw: rawAnswer, minutes: 120 };
    result.isValidAnswer = true;
    result.parsedValue = 120;
    return result;
  }

  // Parse "X שעות"
  const hoursMatch = rawAnswer.match(/(\d+)\s*שעות?/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    result.partialEntities.duration = { raw: rawAnswer, minutes: hours * 60 };
    result.isValidAnswer = true;
    result.parsedValue = hours * 60;
    return result;
  }

  return result;
}

function parsePlanChoiceAnswer(normalizedAnswer: string): ParsedAnswer {
  if (PLAN_A_ANSWERS.some(a => normalizedAnswer.includes(a))) {
    return {
      partialEntities: {},
      isValidAnswer: true,
      parsedValue: 'A',
      needsClarification: false
    };
  }
  
  if (PLAN_B_ANSWERS.some(b => normalizedAnswer.includes(b))) {
    return {
      partialEntities: {},
      isValidAnswer: true,
      parsedValue: 'B',
      needsClarification: false
    };
  }
  
  return {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: true
  };
}

function parseChoiceAnswer(normalizedAnswer: string, options: string[]): ParsedAnswer {
  for (let i = 0; i < options.length; i++) {
    const option = options[i].toLowerCase();
    if (normalizedAnswer.includes(option) || 
        normalizedAnswer === (i + 1).toString() ||
        normalizedAnswer === String.fromCharCode(97 + i)) { // a, b, c...
      return {
        partialEntities: {},
        isValidAnswer: true,
        parsedValue: options[i],
        needsClarification: false
      };
    }
  }
  
  return {
    partialEntities: {},
    isValidAnswer: false,
    parsedValue: null,
    needsClarification: true
  };
}

export function isShortFollowUpAnswer(text: string): boolean {
  const normalized = text.trim();
  
  // Very short text (less than 15 chars) is likely a follow-up
  if (normalized.length < 15) {
    return true;
  }
  
  // Check for common short answers
  const shortPatterns = [
    /^(כן|לא|בטח|אולי|מחר|היום|בסדר|אוקי)$/i,
    /^\d{1,2}$/,           // Single or double digit
    /^\d{1,2}:\d{2}$/,     // Time format
    /^\d+\s*דקות?$/,       // X minutes
    /^(a|b|א|ב|1|2)$/i,    // Plan choice
    /^שעה$/,
    /^שעתיים$/,
    /^חצי שעה$/
  ];
  
  return shortPatterns.some(pattern => pattern.test(normalized));
}

export interface UpdateResult {
  field: 'time' | 'date' | 'duration' | 'choice' | 'confirm' | 'unknown';
  value: string | null;
  parsed: boolean;
}

export function parseAnswerToUpdate(
  answerText: string,
  expectedAnswerType: string,
  options?: string[]
): UpdateResult {
  const normalized = answerText.trim().toLowerCase();
  const raw = answerText.trim();
  
  if (expectedAnswerType === 'time') {
    const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return {
          field: 'time',
          value: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
          parsed: true,
        };
      }
    }
    
    const numberMatch = raw.match(/^(\d{1,2})$/);
    if (numberMatch) {
      const hours = parseInt(numberMatch[1], 10);
      if (hours >= 0 && hours < 24) {
        const adjustedHours = hours < 7 ? hours + 12 : hours;
        return {
          field: 'time',
          value: `${adjustedHours.toString().padStart(2, '0')}:00`,
          parsed: true,
        };
      }
    }
    
    if (normalized.includes('עכשיו')) {
      const now = new Date();
      return {
        field: 'time',
        value: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        parsed: true,
      };
    }
    
    if (normalized.includes('בעוד 20 דק')) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 20);
      return {
        field: 'time',
        value: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        parsed: true,
      };
    }
  }
  
  if (expectedAnswerType === 'date') {
    const today = new Date();
    
    if (normalized.includes('היום')) {
      return {
        field: 'date',
        value: today.toISOString().split('T')[0],
        parsed: true,
      };
    }
    
    if (normalized.includes('מחר')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        field: 'date',
        value: tomorrow.toISOString().split('T')[0],
        parsed: true,
      };
    }
    
    if (normalized.includes('מחרתיים')) {
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      return {
        field: 'date',
        value: dayAfter.toISOString().split('T')[0],
        parsed: true,
      };
    }
  }
  
  if (expectedAnswerType === 'duration') {
    const minutesMatch = raw.match(/(\d+)\s*דק/);
    if (minutesMatch) {
      return {
        field: 'duration',
        value: minutesMatch[1],
        parsed: true,
      };
    }
    
    if (normalized.includes('חצי שעה')) {
      return { field: 'duration', value: '30', parsed: true };
    }
    
    if (normalized.match(/^שעה(\s+אחת)?$/)) {
      return { field: 'duration', value: '60', parsed: true };
    }
    
    if (normalized.includes('שעתיים')) {
      return { field: 'duration', value: '120', parsed: true };
    }
    
    const hoursMatch = raw.match(/(\d+)\s*שעות?/);
    if (hoursMatch) {
      return { field: 'duration', value: String(parseInt(hoursMatch[1]) * 60), parsed: true };
    }
  }
  
  if (expectedAnswerType === 'choice' && options) {
    for (const option of options) {
      if (normalized.includes(option.toLowerCase())) {
        return { field: 'choice', value: option, parsed: true };
      }
    }
  }
  
  if (expectedAnswerType === 'confirm') {
    if (['כן', 'בטח', 'נכון', 'כמובן', 'אוקי', 'ok', 'yes'].some(y => normalized.includes(y))) {
      return { field: 'confirm', value: 'yes', parsed: true };
    }
    if (['לא', 'ממש לא', 'no'].some(n => normalized.includes(n))) {
      return { field: 'confirm', value: 'no', parsed: true };
    }
  }
  
  return { field: 'unknown', value: raw, parsed: false };
}
