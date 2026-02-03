/**
 * Outcome Detector - זיהוי תוצאות מטקסט עברי
 * 
 * מזהה ביטויים שמייצגים דדליין מציאותי:
 * - "צריך לצאת ב..."
 * - "יש לי אוטובוס ב..."
 * - "העבודה מתחילה ב..."
 */

import {
  OutcomeDetectionResult,
  OUTCOME_TRIGGER_PHRASES_HE,
  DEFAULT_ADHD_BUFFER_MINUTES
} from './types';

export interface ParsedTime {
  hours: number;
  minutes: number;
}

export function detectOutcomeFromText(
  text: string,
  currentTime?: Date
): OutcomeDetectionResult {
  const normalizedText = text.trim();
  
  for (const phrase of OUTCOME_TRIGGER_PHRASES_HE) {
    if (normalizedText.includes(phrase)) {
      const timeMatch = extractTimeFromText(normalizedText);
      
      if (timeMatch) {
        const deadlineTime = buildDeadlineTime(timeMatch, currentTime || new Date());
        const buffer = determineBuffer(normalizedText);
        
        return {
          isOutcome: true,
          confidence: 0.9,
          deadlineTime,
          suggestedBuffer: buffer,
          reason: `זוהה ביטוי תוצאה: "${phrase}"`,
          triggerPhrase: phrase
        };
      }
      
      return {
        isOutcome: true,
        confidence: 0.6,
        suggestedBuffer: DEFAULT_ADHD_BUFFER_MINUTES,
        reason: `זוהה ביטוי תוצאה ללא זמן מדויק: "${phrase}"`,
        triggerPhrase: phrase
      };
    }
  }
  
  if (hasImplicitDeadline(normalizedText)) {
    return {
      isOutcome: true,
      confidence: 0.5,
      suggestedBuffer: DEFAULT_ADHD_BUFFER_MINUTES,
      reason: 'זוהה דדליין משתמע'
    };
  }
  
  return {
    isOutcome: false,
    confidence: 0,
    suggestedBuffer: 0,
    reason: 'לא זוהה ביטוי תוצאה'
  };
}

function extractTimeFromText(text: string): ParsedTime | null {
  const patterns = [
    /ב[־-]?(\d{1,2}):(\d{2})/,
    /ב[־-]?(\d{1,2})\.(\d{2})/,
    /ב[־-]?(\d{1,2})/,
    /בשעה (\d{1,2}):?(\d{2})?/,
    /(\d{1,2}):(\d{2})/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      
      if (text.includes('בערב') || text.includes('אחה"צ')) {
        if (hours < 12) hours += 12;
      }
      if (text.includes('בבוקר') && hours === 12) {
        hours = 0;
      }
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes };
      }
    }
  }
  
  const hebrewNumbers: Record<string, number> = {
    'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
    'אחת עשרה': 11, 'שתים עשרה': 12, 'אחת': 1, 'שתיים': 2,
    'שלוש': 3, 'ארבע': 4, 'חמש': 5
  };
  
  for (const [word, num] of Object.entries(hebrewNumbers)) {
    if (text.includes(`ב${word}`) || text.includes(`בשעה ${word}`)) {
      let hours = num;
      if (text.includes('בערב') && hours < 12) hours += 12;
      return { hours, minutes: 0 };
    }
  }
  
  return null;
}

function buildDeadlineTime(parsed: ParsedTime, currentTime: Date): Date {
  const deadline = new Date(currentTime);
  deadline.setHours(parsed.hours, parsed.minutes, 0, 0);
  
  if (deadline <= currentTime) {
    deadline.setDate(deadline.getDate() + 1);
  }
  
  return deadline;
}

function determineBuffer(text: string): number {
  if (text.includes('טיסה') || text.includes('רכבת')) {
    return 30;
  }
  if (text.includes('פגישה חשובה') || text.includes('ראיון')) {
    return 20;
  }
  if (text.includes('עבודה')) {
    return 15;
  }
  
  return DEFAULT_ADHD_BUFFER_MINUTES;
}

function hasImplicitDeadline(text: string): boolean {
  const implicitPatterns = [
    /חייב.*לפני/,
    /חייבת.*לפני/,
    /עד.*בבוקר/,
    /עד.*בערב/,
    /לא יאוחר מ/
  ];
  
  return implicitPatterns.some(pattern => pattern.test(text));
}

export function isPreparationTask(text: string): boolean {
  const prepKeywords = [
    'להתארגן', 'להתלבש', 'לאכול', 'להתקלח',
    'להתכונן', 'הכנה', 'לארוז', 'לסדר', 'להכין',
    'ארוחת בוקר', 'התארגנות', 'התכוננות'
  ];
  
  return prepKeywords.some(keyword => text.includes(keyword));
}
