/**
 * Hebrew Temporal Dictionaries
 * Comprehensive dictionaries for Hebrew time/date parsing
 */

export const HEBREW_UNITS: Record<string, number> = {
  'אפס': 0,
  'אחת': 1,
  'אחד': 1,
  'שתיים': 2,
  'שניים': 2,
  'שני': 2,
  'שלוש': 3,
  'שלושה': 3,
  'ארבע': 4,
  'ארבעה': 4,
  'חמש': 5,
  'חמישה': 5,
  'שש': 6,
  'שישה': 6,
  'שבע': 7,
  'שבעה': 7,
  'שמונה': 8,
  'תשע': 9,
  'תשעה': 9,
  'עשר': 10,
  'עשרה': 10,
};

export const HEBREW_TEENS: Record<string, number> = {
  'אחת עשרה': 11,
  'אחד עשר': 11,
  'שתים עשרה': 12,
  'שנים עשר': 12,
  'שלוש עשרה': 13,
  'שלושה עשר': 13,
  'ארבע עשרה': 14,
  'ארבעה עשר': 14,
  'חמש עשרה': 15,
  'חמישה עשר': 15,
  'שש עשרה': 16,
  'ששה עשר': 16,
  'שבע עשרה': 17,
  'שבעה עשר': 17,
  'שמונה עשרה': 18,
  'שמונה עשר': 18,
  'תשע עשרה': 19,
  'תשעה עשר': 19,
};

export const HEBREW_TENS: Record<string, number> = {
  'עשרים': 20,
  'שלושים': 30,
  'ארבעים': 40,
  'חמישים': 50,
};

export const HEBREW_HOUR_WORDS = new Set([
  'אחת', 'אחד', 'שתיים', 'שניים', 'שלוש', 'ארבע', 'חמש', 'שש',
  'שבע', 'שמונה', 'תשע', 'עשר', 'עשרה',
  'אחת עשרה', 'אחד עשר', 'שתים עשרה', 'שנים עשר'
]);

export const ROUND_HOUR_MARKERS = new Set([
  'בדיוק', 'עגול', 'אפס', 'על הדקה', 'בול'
]);

export const WEEKDAYS_HE: Record<string, number> = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6,
  "א'": 0,
  "ב'": 1,
  "ג'": 2,
  "ד'": 3,
  "ה'": 4,
  "ו'": 5,
  'א': 0,
  'ב': 1,
  'ג': 2,
  'ד': 3,
  'ה': 4,
  'ו': 5,
};

export const DAY_PARTS: Record<string, { start: number; end: number; pmOffset: boolean }> = {
  'בבוקר': { start: 5, end: 12, pmOffset: false },
  'בוקר': { start: 5, end: 12, pmOffset: false },
  'בצהריים': { start: 11, end: 14, pmOffset: true },
  'צהריים': { start: 11, end: 14, pmOffset: true },
  'אחר הצהריים': { start: 12, end: 17, pmOffset: true },
  'אחה"צ': { start: 12, end: 17, pmOffset: true },
  'בערב': { start: 17, end: 22, pmOffset: true },
  'ערב': { start: 17, end: 22, pmOffset: true },
  'בלילה': { start: 20, end: 4, pmOffset: true },
  'לילה': { start: 20, end: 4, pmOffset: true },
  'לפנות בוקר': { start: 0, end: 5, pmOffset: false },
};

export const RELATIVE_DATES_HE: Record<string, number> = {
  'היום': 0,
  'מחר': 1,
  'מחרתיים': 2,
  'אתמול': -1,
  'שלשום': -2,
};

export const DURATION_UNITS_HE: Record<string, number> = {
  'דקה': 1,
  'דקות': 1,
  'רבע שעה': 15,
  'חצי שעה': 30,
  'שעה': 60,
  'שעות': 60,
  'שעתיים': 120,
  'יום': 1440,
  'יומיים': 2880,
  'ימים': 1440,
  'שבוע': 10080,
  'שבועיים': 20160,
  'שבועות': 10080,
  'חודש': 43200,
  'חודשיים': 86400,
  'חודשים': 43200,
};

export const AMBIGUITY_MARKERS: Record<string, { softness: 'soft' | 'hard'; windows?: string[] }> = {
  'בערך': { softness: 'soft' },
  'לקראת': { softness: 'soft' },
  'בסביבות': { softness: 'soft' },
  'מתישהו': { softness: 'soft' },
  'כשיהיה זמן': { softness: 'soft' },
  'מאוחר יותר': { softness: 'soft', windows: ['afternoon', 'evening'] },
  'בהמשך': { softness: 'soft' },
  'סוף היום': { softness: 'soft', windows: ['evening'] },
  'סוף השבוע': { softness: 'soft', windows: ['weekend'] },
  'תחילת השבוע': { softness: 'soft', windows: ['weekStart'] },
  'ASAP': { softness: 'hard' },
  'דחוף': { softness: 'hard' },
  'בהקדם': { softness: 'hard' },
};

export const RECURRENCE_PATTERNS_HE: Record<string, { freq: string; interval?: number }> = {
  'כל יום': { freq: 'daily', interval: 1 },
  'יומי': { freq: 'daily', interval: 1 },
  'כל יומיים': { freq: 'daily', interval: 2 },
  'כל שבוע': { freq: 'weekly', interval: 1 },
  'שבועי': { freq: 'weekly', interval: 1 },
  'כל שבועיים': { freq: 'weekly', interval: 2 },
  'כל חודש': { freq: 'monthly', interval: 1 },
  'חודשי': { freq: 'monthly', interval: 1 },
  'פעמיים בשבוע': { freq: 'weekly', interval: 1 },
  'פעם בשבוע': { freq: 'weekly', interval: 1 },
  'פעם בחודש': { freq: 'monthly', interval: 1 },
};
