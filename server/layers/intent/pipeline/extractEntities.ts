// Step 5: Entity extraction

import type { ExtractedEntities, ConstraintData, ConstraintType, RelativeAnchor, RelativeAnchorType } from '../types';
import { 
  TIME_PATTERNS, 
  DATE_PATTERNS, 
  DURATION_PATTERNS,
  PEOPLE_PATTERNS,
  LOCATION_PATTERNS,
  CONSTRAINT_PATTERNS,
  HEBREW_NUMBERS
} from '../rules/patterns';
import { URGENCY_KEYWORDS, MUST_KEYWORDS, ACTION_VERBS } from '../rules/keywords';

// Relative anchor patterns for Hebrew
const RELATIVE_ANCHOR_PATTERNS = {
  afterCurrentBlockEnd: [
    /מהרגע\s*ש(ה)?משימה\s*(ה)?נוכחית\s*(נ)?גמרת?/,
    /אחרי\s*(ה)?משימה\s*(ה)?נוכחית/,
    /כש(אני)?\s*מסיים\s*(את\s*)?(מה\s*ש)?עכשיו/,
    /ברגע\s*ש(אני)?\s*מסיים/,
    /כשזה\s*נגמר/,
    /אחרי\s*שאני\s*מסיים/
  ],
  atNextBlockStart: [
    /מתחילת\s*(ה)?משימה\s*(ה)?באה/,
    /מ(ה)?התחלה\s*(של\s*)?(ה)?משימה\s*(ה)?באה/,
    /בתחילת\s*(ה)?משימה\s*(ה)?באה/,
    /כש(ה)?משימה\s*(ה)?באה\s*מתחילה/
  ],
  afterNextBlockEnd: [
    /אחרי\s*(ה)?משימה\s*(ה)?באה/,
    /כש(ה)?משימה\s*(ה)?באה\s*(מ)?סתיימת?/,
    /אחרי\s*ש(ה)?משימה\s*(ה)?באה\s*(נ)?גמרת?/,
    /בסוף\s*(ה)?משימה\s*(ה)?באה/
  ]
};

function hebrewToNumber(word: string): number | null {
  return HEBREW_NUMBERS[word] ?? null;
}

// Contextual Time Disambiguation - linguistic context keywords
const TIME_CONTEXT_KEYWORDS = {
  morning: { pattern: /בוקר/, range: [6, 11] },      // 06:00-11:59
  noon: { pattern: /צהריים/, range: [12, 15] },      // 12:00-15:59
  afternoon: { pattern: /אחה"צ|אחר\s*הצהריים/, range: [16, 18] }, // 16:00-18:59
  evening: { pattern: /ערב/, range: [19, 21] },      // 19:00-21:59
  night: { pattern: /לילה/, range: [22, 4] }         // 22:00-04:59
};

// Get linguistic time context from text
function getTimeContext(text: string): { min: number; max: number; reason: string } | null {
  for (const [name, { pattern, range }] of Object.entries(TIME_CONTEXT_KEYWORDS)) {
    if (pattern.test(text)) {
      return { min: range[0], max: range[1], reason: `linguistic:${name}` };
    }
  }
  return null;
}

// Disambiguate time based on context (future-biased)
function disambiguateHour(hour: number, nowHour: number, context: { min: number; max: number; reason: string } | null): { resolvedHour: number; reason: string } {
  // If linguistic context exists, use it
  if (context) {
    // Night is special case (22-4 spans midnight)
    if (context.reason === 'linguistic:night') {
      if (hour <= 4) return { resolvedHour: hour, reason: context.reason };
      if (hour >= 22) return { resolvedHour: hour, reason: context.reason };
      if (hour === 12) return { resolvedHour: 0, reason: context.reason }; // "12 בלילה" = midnight
      // For hours 1-4 in "night" context, keep them as-is (e.g., "2 בלילה" = 02:00)
      if (hour >= 1 && hour <= 4) return { resolvedHour: hour, reason: context.reason };
      // For hours 5-11 in night context, add 12 if that would be valid, otherwise clamp to range
      const hour12 = (hour + 12) % 24;
      if (hour12 >= 22 || hour12 <= 4) return { resolvedHour: hour12, reason: context.reason };
      // Fallback: use original hour
      return { resolvedHour: hour, reason: context.reason };
    }
    
    // Morning context (6-11): handle low hours like "1 בבוקר" - clamp to min
    if (context.reason === 'linguistic:morning') {
      if (hour >= context.min && hour <= context.max) {
        return { resolvedHour: hour, reason: context.reason };
      }
      // Hour doesn't fit, clamp to range boundaries
      if (hour < context.min) {
        return { resolvedHour: context.min, reason: context.reason };
      }
      return { resolvedHour: context.max, reason: context.reason };
    }
    
    // For other contexts, adjust to fit range
    if (hour >= context.min && hour <= context.max) {
      return { resolvedHour: hour, reason: context.reason };
    }
    // If hour + 12 fits the range, use it
    const hour12 = (hour + 12) % 24;
    if (hour12 >= context.min && hour12 <= context.max) {
      return { resolvedHour: hour12, reason: context.reason };
    }
    // Clamp to context range boundaries
    if (hour < context.min) {
      return { resolvedHour: context.min, reason: context.reason };
    }
    return { resolvedHour: context.max, reason: context.reason };
  }
  
  // No linguistic context - use future-biased temporal proximity
  const option1 = hour;
  const option2 = (hour + 12) % 24;
  
  // Calculate hours until each option (future only)
  const hoursUntil1 = option1 > nowHour ? option1 - nowHour : (24 - nowHour) + option1;
  const hoursUntil2 = option2 > nowHour ? option2 - nowHour : (24 - nowHour) + option2;
  
  // Choose the nearest future option
  if (hoursUntil1 <= hoursUntil2) {
    return { resolvedHour: option1, reason: 'temporal_proximity' };
  }
  return { resolvedHour: option2, reason: 'temporal_proximity' };
}

function extractTime(text: string, nowOverride?: Date): { raw: string; normalized: string; confidence: number; reason?: string } {
  const now = nowOverride || new Date();
  const nowHour = now.getHours();
  const context = getTimeContext(text);
  
  // Explicit time with colon (e.g., "14:30")
  let match = text.match(TIME_PATTERNS.explicit);
  if (match) {
    const hour = parseInt(match[1]);
    const minute = match[2] ? match[2].substring(1) : '00';
    // Full explicit time is already unambiguous
    return { raw: match[0], normalized: `${hour.toString().padStart(2, '0')}:${minute}`, confidence: 0.95, reason: 'explicit' };
  }
  
  // Hebrew word numbers (e.g., "בשלוש")
  match = text.match(TIME_PATTERNS.hebrewWords);
  if (match) {
    const num = hebrewToNumber(match[1]);
    if (num !== null) {
      const { resolvedHour, reason } = disambiguateHour(num, nowHour, context);
      return { raw: match[0], normalized: `${resolvedHour.toString().padStart(2, '0')}:00`, confidence: 0.85, reason };
    }
  }
  
  // Short numeric time (e.g., "ב12", "12")
  match = text.match(TIME_PATTERNS.short);
  if (match) {
    const hour = parseInt(match[1]);
    const minute = match[2] ? match[2].substring(1) : '00';
    const { resolvedHour, reason } = disambiguateHour(hour, nowHour, context);
    return { raw: match[0], normalized: `${resolvedHour.toString().padStart(2, '0')}:${minute}`, confidence: 0.85, reason };
  }
  
  // Standalone number (just "12" or "2")
  const standaloneMatch = text.match(/\b(\d{1,2})\b/);
  if (standaloneMatch) {
    const hour = parseInt(standaloneMatch[1]);
    if (hour >= 1 && hour <= 12) {
      const { resolvedHour, reason } = disambiguateHour(hour, nowHour, context);
      return { raw: standaloneMatch[0], normalized: `${resolvedHour.toString().padStart(2, '0')}:00`, confidence: 0.75, reason };
    }
  }
  
  return { raw: '', normalized: '', confidence: 0 };
}

function extractDate(text: string): { raw: string; normalized: string; confidence: number } {
  const today = new Date();
  
  if (DATE_PATTERNS.today.test(text)) {
    return { raw: 'היום', normalized: today.toISOString().split('T')[0], confidence: 0.95 };
  }
  
  if (DATE_PATTERNS.tomorrow.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { raw: 'מחר', normalized: tomorrow.toISOString().split('T')[0], confidence: 0.95 };
  }
  
  if (DATE_PATTERNS.dayAfter.test(text)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return { raw: 'מחרתיים', normalized: dayAfter.toISOString().split('T')[0], confidence: 0.95 };
  }
  
  const dayMatch = text.match(DATE_PATTERNS.dayName);
  if (dayMatch) {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayIndex = dayNames.findIndex(d => dayMatch[2] === d);
    if (dayIndex >= 0) {
      const currentDay = today.getDay();
      let daysToAdd = dayIndex - currentDay;
      if (daysToAdd <= 0 || dayMatch[4]) daysToAdd += 7;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      return { raw: dayMatch[0], normalized: targetDate.toISOString().split('T')[0], confidence: 0.85 };
    }
  }
  
  return { raw: '', normalized: '', confidence: 0 };
}

function extractDuration(text: string): { raw: string; normalized: number; confidence: number } {
  if (DURATION_PATTERNS.halfHour.test(text)) {
    return { raw: 'חצי שעה', normalized: 30, confidence: 0.95 };
  }
  
  if (DURATION_PATTERNS.hourAndHalf.test(text)) {
    return { raw: 'שעה וחצי', normalized: 90, confidence: 0.95 };
  }
  
  if (DURATION_PATTERNS.quarterHour.test(text)) {
    return { raw: 'רבע שעה', normalized: 15, confidence: 0.95 };
  }
  
  let match = text.match(DURATION_PATTERNS.minutes);
  if (match) {
    return { raw: match[0], normalized: parseInt(match[1]), confidence: 0.9 };
  }
  
  match = text.match(DURATION_PATTERNS.hours);
  if (match) {
    return { raw: match[0], normalized: parseInt(match[1]) * 60, confidence: 0.9 };
  }
  
  return { raw: '', normalized: 0, confidence: 0 };
}

function extractPeople(text: string): { raw: string; normalized: string[]; confidence: number } {
  const people: string[] = [];
  let raw = '';
  
  const withMatch = text.match(PEOPLE_PATTERNS.withPerson);
  if (withMatch) {
    people.push(withMatch[1]);
    raw = withMatch[0];
  }
  
  return { raw, normalized: people, confidence: people.length > 0 ? 0.8 : 0 };
}

function extractLocation(text: string): { raw: string; normalized: string; confidence: number } {
  for (const [, pattern] of Object.entries(LOCATION_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      return { raw: match[0], normalized: match[1] || match[0], confidence: 0.85 };
    }
  }
  
  return { raw: '', normalized: '', confidence: 0 };
}

function extractTaskName(text: string): { raw: string; normalized: string; confidence: number } {
  for (const verb of ACTION_VERBS) {
    const pattern = new RegExp(`${verb}\\s+([^,\\.]+)`, 'i');
    const match = text.match(pattern);
    if (match) {
      const taskName = `${verb} ${match[1]}`.trim();
      const words = taskName.split(' ').slice(0, 6);
      return { raw: match[0], normalized: words.join(' '), confidence: 0.85 };
    }
  }
  
  return { raw: '', normalized: '', confidence: 0 };
}

function extractUrgency(text: string): { raw: string; normalized: 'low' | 'medium' | 'high'; confidence: number } {
  for (const kw of URGENCY_KEYWORDS.high) {
    if (text.includes(kw)) {
      return { raw: kw, normalized: 'high', confidence: 0.9 };
    }
  }
  
  for (const kw of URGENCY_KEYWORDS.medium) {
    if (text.includes(kw)) {
      return { raw: kw, normalized: 'medium', confidence: 0.8 };
    }
  }
  
  for (const kw of URGENCY_KEYWORDS.low) {
    if (text.includes(kw)) {
      return { raw: kw, normalized: 'low', confidence: 0.8 };
    }
  }
  
  return { raw: '', normalized: 'low', confidence: 0 };
}

function extractMust(text: string): { raw: string; normalized: boolean; confidence: number } {
  for (const kw of MUST_KEYWORDS) {
    if (text.includes(kw)) {
      return { raw: kw, normalized: true, confidence: 0.9 };
    }
  }
  
  return { raw: '', normalized: false, confidence: 0 };
}

function extractConstraints(text: string): ConstraintData[] {
  const constraints: ConstraintData[] = [];
  
  const deadlineMatch = text.match(CONSTRAINT_PATTERNS.deadline);
  if (deadlineMatch) {
    constraints.push({
      type: 'deadline' as ConstraintType,
      details: { deadline_time: deadlineMatch[2], rawMatch: deadlineMatch[0] }
    });
  }
  
  const hebrewTimeNumbers: Record<string, string> = {
    'אחת': '13', 'שתיים': '14', 'שלוש': '15', 'ארבע': '16', 'חמש': '17',
    'שש': '18', 'שבע': '19', 'שמונה': '20', 'תשע': '21', 'עשר': '22'
  };
  
  const windowMatch = text.match(CONSTRAINT_PATTERNS.allowedWindow);
  if (windowMatch) {
    let startHour = windowMatch[2];
    if (hebrewTimeNumbers[startHour]) {
      startHour = hebrewTimeNumbers[startHour];
    }
    constraints.push({
      type: 'allowed_window' as ConstraintType,
      details: { start: startHour.padStart(2, '0') + ':00', end: null, rawMatch: windowMatch[0] }
    });
  }
  
  const forbiddenMatch = text.match(CONSTRAINT_PATTERNS.forbiddenWindow);
  if (forbiddenMatch) {
    constraints.push({
      type: 'forbidden_window' as ConstraintType,
      details: { period: forbiddenMatch[1] || forbiddenMatch[2], rawMatch: forbiddenMatch[0] }
    });
  }
  
  const energyMatch = text.match(CONSTRAINT_PATTERNS.energyProfile);
  if (energyMatch) {
    constraints.push({
      type: 'energy_profile' as ConstraintType,
      details: { rawMatch: energyMatch[0] }
    });
  }
  
  const reducedMatch = text.match(CONSTRAINT_PATTERNS.reducedLoad);
  if (reducedMatch) {
    constraints.push({
      type: 'reduced_load_day' as ConstraintType,
      details: { rawMatch: reducedMatch[0] }
    });
  }
  
  return constraints;
}

function extractRelativeAnchor(text: string): RelativeAnchor | null {
  // Check for after_current_block_end patterns
  for (const pattern of RELATIVE_ANCHOR_PATTERNS.afterCurrentBlockEnd) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: 'after_current_block_end',
        confidence: 0.9,
        raw: match[0]
      };
    }
  }
  
  // Check for at_next_block_start patterns
  for (const pattern of RELATIVE_ANCHOR_PATTERNS.atNextBlockStart) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: 'at_next_block_start',
        confidence: 0.9,
        raw: match[0]
      };
    }
  }
  
  // Check for after_next_block_end patterns
  for (const pattern of RELATIVE_ANCHOR_PATTERNS.afterNextBlockEnd) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: 'after_next_block_end',
        confidence: 0.9,
        raw: match[0]
      };
    }
  }
  
  return null;
}

// Export for testing
export { extractRelativeAnchor };

export function extractEntities(text: string): ExtractedEntities {
  const time = extractTime(text);
  const date = extractDate(text);
  const duration = extractDuration(text);
  const people = extractPeople(text);
  const location = extractLocation(text);
  const taskName = extractTaskName(text);
  const urgency = extractUrgency(text);
  const must = extractMust(text);
  const constraints = extractConstraints(text);
  const relativeAnchor = extractRelativeAnchor(text);
  
  return {
    time: { raw: time.raw, normalized: time.normalized, confidence: time.confidence },
    date: { raw: date.raw, normalized: date.normalized, confidence: date.confidence },
    duration: { raw: duration.raw, normalized: duration.normalized, confidence: duration.confidence },
    people: { raw: people.raw, normalized: people.normalized, confidence: people.confidence },
    location: { raw: location.raw, normalized: location.normalized, confidence: location.confidence },
    taskName: { raw: taskName.raw, normalized: taskName.normalized, confidence: taskName.confidence },
    urgency: { raw: urgency.raw, normalized: urgency.normalized, confidence: urgency.confidence },
    must: { raw: must.raw, normalized: must.normalized, confidence: must.confidence },
    constraints,
    relativeAnchor
  };
}
