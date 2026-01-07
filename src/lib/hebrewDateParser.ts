import { 
  addDays, 
  addWeeks, 
  addMonths, 
  setHours, 
  setMinutes, 
  startOfDay, 
  endOfDay, 
  getDay, 
  nextDay,
  isSameDay,
  parse,
  isValid,
} from 'date-fns';
import { Task } from '@/types/task';

export interface ParsedDateTime {
  date?: Date;
  hour?: number;
  minute?: number;
  cleanTitle: string;
  parsedExpressions: string[];
}

const HEBREW_DAYS: Record<string, number> = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6,
};

const HEBREW_NUMBERS: Record<string, number> = {
  'אחד': 1, 'אחת': 1,
  'שתיים': 2, 'שניים': 2, 'שני': 2,
  'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7,
  'שמונה': 8,
  'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10,
};

const parseHebrewNumber = (text: string): number | null => {
  const numMatch = text.match(/\d+/);
  if (numMatch) return parseInt(numMatch[0]);
  
  for (const [word, num] of Object.entries(HEBREW_NUMBERS)) {
    if (text.includes(word)) return num;
  }
  return null;
};

const getNextDayOfWeek = (dayNum: number, fromDate: Date = new Date(), includeToday: boolean = false): Date => {
  const today = getDay(fromDate);
  let daysUntil = dayNum - today;
  if (includeToday) {
    if (daysUntil < 0) daysUntil += 7;
  } else {
    if (daysUntil <= 0) daysUntil += 7;
  }
  return addDays(fromDate, daysUntil);
};

const ensureDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  return new Date(value);
};

const findNextFreeSlot = (
  tasks: Task[], 
  date: Date, 
  preferredHour: number = 9,
  durationMinutes: number = 60
): { hour: number; minute: number } | null => {
  const dayTasks = tasks
    .filter(t => isSameDay(ensureDate(t.startTime), date) && t.status !== 'completed' && t.status !== 'not_completed')
    .sort((a, b) => ensureDate(a.startTime).getTime() - ensureDate(b.startTime).getTime());

  if (dayTasks.length === 0) {
    return { hour: preferredHour, minute: 0 };
  }

  for (let hour = 6; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const slotStart = setMinutes(setHours(startOfDay(date), hour), minute);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      
      const hasConflict = dayTasks.some(task => {
        const taskStart = ensureDate(task.startTime).getTime();
        const taskEnd = ensureDate(task.endTime).getTime();
        const start = slotStart.getTime();
        const end = slotEnd.getTime();
        return (start < taskEnd && end > taskStart);
      });

      if (!hasConflict) {
        return { hour, minute };
      }
    }
  }

  return null;
};

const findLastTaskEnd = (tasks: Task[], date: Date): { hour: number; minute: number } | null => {
  const dayTasks = tasks
    .filter(t => isSameDay(ensureDate(t.startTime), date))
    .sort((a, b) => ensureDate(b.endTime).getTime() - ensureDate(a.endTime).getTime());

  if (dayTasks.length === 0) {
    return { hour: 9, minute: 0 };
  }

  const lastTask = dayTasks[0];
  const endTime = ensureDate(lastTask.endTime);
  const hour = endTime.getHours();
  const minute = endTime.getMinutes();
  
  if (hour >= 23 && minute >= 30) return null;
  
  return { hour, minute };
};

export const parseHebrewDateTime = (
  text: string, 
  existingTasks: Task[] = [],
  referenceDate: Date = new Date()
): ParsedDateTime => {
  let cleanTitle = text;
  let date: Date | undefined;
  let hour: number | undefined;
  let minute: number | undefined;
  const parsedExpressions: string[] = [];

  const now = referenceDate;

  const patterns: Array<{
    regex: RegExp;
    handler: (match: RegExpMatchArray) => void;
  }> = [
    {
      regex: /באותה שעה בעוד\s*(\d+|אחד|שתיים|שניים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)\s*(ימים?|שבועות?|חודשים?)/gi,
      handler: (match) => {
        const num = parseHebrewNumber(match[1]) || 1;
        const unit = match[2];
        
        if (unit.includes('יום') || unit.includes('ימים')) {
          date = addDays(now, num);
        } else if (unit.includes('שבוע')) {
          date = addWeeks(now, num);
        } else if (unit.includes('חודש')) {
          date = addMonths(now, num);
        }
        
        hour = now.getHours();
        minute = now.getMinutes();
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /יום\s*(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*בשבוע הבא/gi,
      handler: (match) => {
        const dayName = match[1];
        const dayNum = HEBREW_DAYS[dayName];
        if (dayNum !== undefined) {
          const nextWeekStart = addDays(now, 7 - getDay(now));
          date = getNextDayOfWeek(dayNum, nextWeekStart);
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /ב?יום\s*(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*(הקרוב|הבא)?/gi,
      handler: (match) => {
        const dayName = match[1];
        const modifier = match[2];
        const dayNum = HEBREW_DAYS[dayName];
        if (dayNum !== undefined) {
          const includeToday = modifier === 'הקרוב' || !modifier;
          date = getNextDayOfWeek(dayNum, now, includeToday);
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /מחרתיים/gi,
      handler: (match) => {
        date = addDays(now, 2);
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /מחר/gi,
      handler: (match) => {
        date = addDays(now, 1);
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /היום/gi,
      handler: (match) => {
        date = now;
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /ב?תאריך\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/gi,
      handler: (match) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : now.getFullYear();
        
        const parsedDate = new Date(year, month, day);
        if (isValid(parsedDate)) {
          date = parsedDate;
          parsedExpressions.push(match[0]);
          cleanTitle = cleanTitle.replace(match[0], '').trim();
        }
      }
    },
    {
      regex: /בזמן הפנוי ביום הבא|בזמן הפנוי מחר/gi,
      handler: (match) => {
        const tomorrow = addDays(now, 1);
        date = tomorrow;
        const freeSlot = findNextFreeSlot(existingTasks, tomorrow);
        if (freeSlot) {
          hour = freeSlot.hour;
          minute = freeSlot.minute;
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /בזמן הפנוי הבא/gi,
      handler: (match) => {
        let checkDate = now;
        let found = false;
        
        for (let i = 0; i < 7 && !found; i++) {
          const freeSlot = findNextFreeSlot(existingTasks, checkDate);
          if (freeSlot) {
            if (i === 0) {
              const currentMinutes = now.getHours() * 60 + now.getMinutes();
              const slotMinutes = freeSlot.hour * 60 + freeSlot.minute;
              if (slotMinutes > currentMinutes) {
                date = checkDate;
                hour = freeSlot.hour;
                minute = freeSlot.minute;
                found = true;
              }
            } else {
              date = checkDate;
              hour = freeSlot.hour;
              minute = freeSlot.minute;
              found = true;
            }
          }
          checkDate = addDays(checkDate, 1);
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /אחרי המשימה האחרונה היום/gi,
      handler: (match) => {
        date = now;
        const lastEnd = findLastTaskEnd(existingTasks, now);
        if (lastEnd) {
          hour = lastEnd.hour;
          minute = lastEnd.minute;
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /בעוד\s*(\d+|אחד|שתיים|שניים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)\s*(ימים?|שבועות?|חודשים?)/gi,
      handler: (match) => {
        const num = parseHebrewNumber(match[1]) || 1;
        const unit = match[2];
        
        if (unit.includes('יום') || unit.includes('ימים')) {
          date = addDays(now, num);
        } else if (unit.includes('שבוע')) {
          date = addWeeks(now, num);
        } else if (unit.includes('חודש')) {
          date = addMonths(now, num);
        }
        parsedExpressions.push(match[0]);
        cleanTitle = cleanTitle.replace(match[0], '').trim();
      }
    },
    {
      regex: /ב?שעה\s*(\d{1,2}):(\d{2})/gi,
      handler: (match) => {
        const h = parseInt(match[1]);
        const m = parseInt(match[2]);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          hour = h;
          minute = m;
          parsedExpressions.push(match[0]);
          cleanTitle = cleanTitle.replace(match[0], '').trim();
        }
      }
    },
    {
      regex: /ב?(\d{1,2}):(\d{2})/gi,
      handler: (match) => {
        if (hour === undefined) {
          const h = parseInt(match[1]);
          const m = parseInt(match[2]);
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            hour = h;
            minute = m;
            parsedExpressions.push(match[0]);
            cleanTitle = cleanTitle.replace(match[0], '').trim();
          }
        }
      }
    },
    {
      regex: /ב?שעה\s*(\d{1,2})/gi,
      handler: (match) => {
        if (hour === undefined) {
          const h = parseInt(match[1]);
          if (h >= 0 && h <= 23) {
            hour = h;
            minute = 0;
            parsedExpressions.push(match[0]);
            cleanTitle = cleanTitle.replace(match[0], '').trim();
          }
        }
      }
    },
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpMatchArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      pattern.handler(match);
    }
  }

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
  cleanTitle = cleanTitle.replace(/^[-–—,.:;]+|[-–—,.:;]+$/g, '').trim();

  return {
    date,
    hour,
    minute,
    cleanTitle,
    parsedExpressions,
  };
};

export const hasDateTimeInfo = (parsed: ParsedDateTime): boolean => {
  return parsed.date !== undefined || parsed.hour !== undefined;
};
