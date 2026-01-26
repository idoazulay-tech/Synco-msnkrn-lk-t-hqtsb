/**
 * Parse Ambiguous Time Expressions
 * Handles: בערך, לקראת, מתישהו, סוף היום, סוף השבוע, etc.
 * Returns TemporalHints instead of specific times
 */

import { AMBIGUITY_MARKERS } from '../dictionaries';
import { tokenize } from '../tokenizer';
import { AmbiguousTime, TemporalHints, PreferredWindow } from '../types';
import { format, addDays, endOfDay, startOfWeek, endOfWeek, nextSaturday, nextFriday } from 'date-fns';

const WINDOW_DEFINITIONS: Record<string, PreferredWindow> = {
  'morning': { label: 'בוקר', startHour: 6, endHour: 12 },
  'noon': { label: 'צהריים', startHour: 11, endHour: 14 },
  'afternoon': { label: 'אחה"צ', startHour: 12, endHour: 17 },
  'evening': { label: 'ערב', startHour: 17, endHour: 22 },
  'night': { label: 'לילה', startHour: 20, endHour: 24 },
  'weekend': { label: 'סוף שבוע', startHour: 0, endHour: 24 },
  'weekStart': { label: 'תחילת שבוע', startHour: 8, endHour: 18 },
};

export function parseAmbiguity(text: string, now: Date): AmbiguousTime | null {
  const tokens = tokenize(text);
  
  for (const [marker, info] of Object.entries(AMBIGUITY_MARKERS)) {
    if (text.includes(marker)) {
      const hints: TemporalHints = {
        softness: info.softness
      };
      
      if (info.windows) {
        hints.preferredWindows = info.windows
          .map(w => WINDOW_DEFINITIONS[w])
          .filter(Boolean);
      }
      
      let date: string | undefined;
      let latest: string | undefined;
      
      if (marker === 'סוף היום') {
        date = format(now, 'yyyy-MM-dd');
        hints.preferredWindows = [WINDOW_DEFINITIONS['evening']];
        latest = format(endOfDay(now), "yyyy-MM-dd'T'23:59");
      }
      
      if (marker === 'סוף השבוע') {
        const friday = nextFriday(now);
        const saturday = nextSaturday(now);
        date = format(friday, 'yyyy-MM-dd');
        hints.preferredWindows = [WINDOW_DEFINITIONS['weekend']];
        latest = format(saturday, "yyyy-MM-dd'T'23:59");
      }
      
      if (marker === 'תחילת השבוע') {
        const weekStart = startOfWeek(addDays(now, 7), { weekStartsOn: 0 });
        date = format(weekStart, 'yyyy-MM-dd');
        hints.preferredWindows = [WINDOW_DEFINITIONS['weekStart']];
      }
      
      if (marker === 'ASAP' || marker === 'דחוף' || marker === 'בהקדם') {
        hints.softness = 'hard';
        date = format(now, 'yyyy-MM-dd');
        latest = format(endOfDay(now), "yyyy-MM-dd'T'23:59");
      }
      
      if (marker === 'מאוחר יותר' || marker === 'בהמשך') {
        date = format(now, 'yyyy-MM-dd');
        hints.preferredWindows = [
          WINDOW_DEFINITIONS['afternoon'],
          WINDOW_DEFINITIONS['evening']
        ];
      }
      
      if (latest) {
        hints.latest = latest;
      }
      
      return {
        type: 'ambiguous',
        hints,
        date,
        confidence: 0.7,
        sourceText: text,
        reason: `ambiguous_${marker}`
      };
    }
  }
  
  if (text.includes('כשיהיה') || text.includes('כשאוכל') || text.includes('כשאפנה')) {
    return {
      type: 'ambiguous',
      hints: {
        softness: 'soft'
      },
      confidence: 0.5,
      sourceText: text,
      reason: 'conditional_availability'
    };
  }
  
  return null;
}
