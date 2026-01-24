// PATCH 4: Time Parsing Policy for MVP
// Defines what time formats are supported without external libraries

export interface TimeParseResult {
  raw: string;
  iso: string;          // Empty string if ambiguous
  isAmbiguous: boolean;
  ambiguityReason?: string;
  suggestedOptions?: string[];
}

export interface DateParseResult {
  raw: string;
  iso: string;
  isRelative: boolean;
}

export interface DurationParseResult {
  raw: string;
  minutes: number;
}

const HEBREW_DAYS = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6
};

const TIME_CONTEXT_MORNING = ['בוקר', 'בבוקר', 'am'];
const TIME_CONTEXT_AFTERNOON = ['צהריים', 'אחהצ', 'אחר הצהריים', 'pm'];
const TIME_CONTEXT_EVENING = ['ערב', 'בערב', 'לילה'];

export function parseTime(text: string): TimeParseResult {
  const result: TimeParseResult = {
    raw: text,
    iso: '',
    isAmbiguous: false
  };

  // Pattern 1: HH:MM format
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      result.iso = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return result;
    }
  }

  // Pattern 2: "ב-X" or just a number with context
  const numberMatch = text.match(/ב[־-]?(\d{1,2})|^(\d{1,2})$/);
  if (numberMatch) {
    const hours = parseInt(numberMatch[1] || numberMatch[2], 10);
    
    if (hours >= 0 && hours <= 23) {
      const normalizedText = text.toLowerCase();
      
      // Check for AM/PM context
      const isMorning = TIME_CONTEXT_MORNING.some(ctx => normalizedText.includes(ctx));
      const isAfternoon = TIME_CONTEXT_AFTERNOON.some(ctx => normalizedText.includes(ctx));
      const isEvening = TIME_CONTEXT_EVENING.some(ctx => normalizedText.includes(ctx));
      
      if (isMorning && hours <= 12) {
        result.iso = `${hours.toString().padStart(2, '0')}:00`;
        return result;
      }
      
      if (isAfternoon || isEvening) {
        const adjustedHours = hours < 12 ? hours + 12 : hours;
        result.iso = `${adjustedHours.toString().padStart(2, '0')}:00`;
        return result;
      }
      
      // Ambiguous - no context
      if (hours > 0 && hours <= 12) {
        result.isAmbiguous = true;
        result.ambiguityReason = 'time_format_clarification';
        result.suggestedOptions = [
          `${hours}:00 בבוקר`,
          `${hours + 12}:00 אחהצ/ערב`
        ];
        return result;
      }
      
      // Unambiguous (13-23)
      if (hours > 12 && hours <= 23) {
        result.iso = `${hours.toString().padStart(2, '0')}:00`;
        return result;
      }
    }
  }

  return result;
}

export function parseDate(text: string): DateParseResult {
  const result: DateParseResult = {
    raw: text,
    iso: '',
    isRelative: false
  };

  const today = new Date();
  const normalizedText = text.toLowerCase().trim();

  // Pattern 1: היום
  if (normalizedText === 'היום' || normalizedText.includes('היום')) {
    result.iso = today.toISOString().split('T')[0];
    result.isRelative = true;
    return result;
  }

  // Pattern 2: מחר
  if (normalizedText === 'מחר' || normalizedText.includes('מחר')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.iso = tomorrow.toISOString().split('T')[0];
    result.isRelative = true;
    return result;
  }

  // Pattern 3: מחרתיים
  if (normalizedText === 'מחרתיים' || normalizedText.includes('מחרתיים')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    result.iso = dayAfter.toISOString().split('T')[0];
    result.isRelative = true;
    return result;
  }

  // Pattern 4: Day of week (returns raw only for MVP - can't calculate without knowing which week)
  for (const [dayName, dayIndex] of Object.entries(HEBREW_DAYS)) {
    if (normalizedText.includes(dayName)) {
      result.raw = dayName;
      // Calculate next occurrence of this day
      const currentDay = today.getDay();
      let daysUntil = dayIndex - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      result.iso = targetDate.toISOString().split('T')[0];
      result.isRelative = true;
      return result;
    }
  }

  // Pattern 5: DD/MM or DD.MM format
  const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = today.getFullYear();
      result.iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      return result;
    }
  }

  return result;
}

export function parseDuration(text: string): DurationParseResult {
  const result: DurationParseResult = {
    raw: text,
    minutes: 0
  };

  const normalizedText = text.toLowerCase();

  // Pattern 1: X דקות
  const minutesMatch = text.match(/(\d+)\s*דקות?/);
  if (minutesMatch) {
    result.minutes = parseInt(minutesMatch[1], 10);
    return result;
  }

  // Pattern 2: חצי שעה
  if (normalizedText.includes('חצי שעה')) {
    result.minutes = 30;
    return result;
  }

  // Pattern 3: רבע שעה
  if (normalizedText.includes('רבע שעה')) {
    result.minutes = 15;
    return result;
  }

  // Pattern 4: שעה (one hour)
  if (normalizedText.match(/^שעה(\s+אחת)?$/) || normalizedText === 'שעה') {
    result.minutes = 60;
    return result;
  }

  // Pattern 5: שעתיים (two hours)
  if (normalizedText.includes('שעתיים')) {
    result.minutes = 120;
    return result;
  }

  // Pattern 6: X שעות
  const hoursMatch = text.match(/(\d+)\s*שעות?/);
  if (hoursMatch) {
    result.minutes = parseInt(hoursMatch[1], 10) * 60;
    return result;
  }

  // Pattern 7: "עוד X דקות" (relative duration)
  const relativeMatch = text.match(/עוד\s+(\d+)\s*דקות?/);
  if (relativeMatch) {
    result.minutes = parseInt(relativeMatch[1], 10);
    return result;
  }

  return result;
}

export function isTimeAmbiguous(timeText: string): boolean {
  const parseResult = parseTime(timeText);
  return parseResult.isAmbiguous;
}

export function getDefaultDuration(taskType?: string): number {
  // Default durations by task type (PATCH 3 integration)
  const defaults: Record<string, number> = {
    cooking: 45,
    dishes: 15,
    shopping: 30,
    work: 60,
    home: 30,
    health: 30,
    dog: 20,
    general: 30
  };
  
  return defaults[taskType || 'general'] || 30;
}
