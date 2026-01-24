export type TaskType = 'meeting' | 'appointment' | 'errand' | 'task' | 'reminder';
export type Priority = 'low' | 'medium' | 'high';
export type MoodHint = 'calm' | 'stressed' | 'angry' | 'sad' | 'anxious' | 'excited' | 'tired' | 'neutral';
export type Flexibility = 'fixed' | 'flexible';

export interface TaskOutput {
  title: string;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  participants: string[];
  type: TaskType;
  priority: Priority;
  flexibility: Flexibility;
  notes: string | null;
  source: 'voice';
  confidence: 'high' | 'medium' | 'low';
  needs_clarification: boolean;
  clarifying_question: string | null;
}

export interface JournalOutput {
  title: string;
  entry_text: string;
  timestamp_local: string;
  tags: string[];
  mood_hint: MoodHint;
  intensity: 1 | 2 | 3 | 4 | 5;
  action_suggestion: string | null;
}

export interface SuggestedTask {
  title: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LearningLog {
  new_time_phrases: string[];
  new_date_phrases: string[];
  new_location_phrases: string[];
  new_intent_phrases: string[];
  new_task_phrases: string[];
  new_emotion_phrases: string[];
  unclassified_phrases: string[];
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingTasks: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  isRelated: boolean;
  relationReason?: string;
  reorganizationQuestion?: string;
}

export interface ExistingTask {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

export interface InterpretResult {
  mode: 'task_or_event' | 'journal_entry';
  task: TaskOutput | null;
  journal: JournalOutput | null;
  suggested_tasks_from_journal: SuggestedTask[];
  learning_log: LearningLog;
  conflict?: ConflictInfo;
}

const TIME_SIGNALS = ['בשעה', 'שעה', 'בשעות', 'משעה', 'עד שעה', 'לפני', 'אחרי', 'בסביבות', 'בערך', 'לקראת', 'בבוקר', 'בצהריים', 'אחהצ', 'אחר הצהריים', 'בערב', 'בלילה', 'לפנות בוקר', 'עד הערב', 'בסוף היום', 'תחילת היום'];

const DATE_SIGNALS = ['היום', 'מחר', 'מחרתיים', 'בעוד ימים', 'בעוד שבוע', 'בעוד חודש', 'השבוע', 'שבוע הבא', 'בשבוע הבא', 'החודש', 'חודש הבא', 'בימים הקרובים', 'בהמשך היום', 'בסופ"ש', 'בסוף שבוע', 'סוף השבוע', 'מחר בבוקר', 'מחר בערב', 'היום בערב', 'היום בבוקר', 'בתאריך'];

const DAYS_OF_WEEK = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

const ACTION_VERBS = ['לקנות', 'להתקשר', 'לשלוח', 'לקבוע', 'להגיש', 'לסיים', 'לעשות', 'לסדר', 'לארגן', 'להכין', 'לבדוק', 'לברר', 'לעדכן', 'למלא', 'להתחיל', 'לטפל', 'לאסוף', 'להביא', 'להחזיר', 'למסור'];

const REMINDER_TRIGGERS = ['תזכיר לי', 'לא לשכוח', 'תזכורת', 'אל תשכח', 'להזכיר'];

const COMMITMENT_WORDS = ['חייב', 'צריך', 'אסור לשכוח', 'מוכרח', 'חובה'];

const STUCK_PHRASES = ['אני תקוע', 'לא זז', 'לא מתקדם', 'שום דבר לא קורה', 'אני דורך במקום', 'זה לא זז', 'אני מרגיש תקוע', 'לא מצליח לצאת מזה', 'אין לי מושג מאיפה להתחיל', 'הכל עומד', 'קפוא', 'מרגיש תקיעות'];

const MENTAL_LOAD_PHRASES = ['הראש שלי מפוצץ', 'יש לי יותר מדי', 'הכל עליי', 'אין לי אוויר', 'אני טובע', 'זה גדול עליי', 'עמוס לי', 'אין לי קיבולת', 'מוצף', 'קורס', 'קורס נפשית', 'אין לי כוח לחשוב', 'עומס מטורף'];

const PROCRASTINATION_PHRASES = ['אני דוחה', 'דחיתי שוב', 'עוד לא עשיתי', 'אני לא נוגע בזה', 'לא פתחתי את זה', 'אני בורח מזה', 'אני נמנע', 'אני שם את זה בצד', 'לא מתקרב לזה', 'מתעלם', 'מחכה שיהיה לי כוח'];

const OBLIGATION_PHRASES = ['אם אני לא', 'זה יתפוצץ', 'אני בבעיה אם', 'אני אסתבך אם', 'זה יהרוס לי', 'אני נדפק אם', 'זה מסוכן אם', 'אסור שזה יקרה', 'אני חייב לפני ש', 'זה קריטי', 'זה על הראש שלי'];

const CHAOS_PHRASES = ['הכל מבולגן', 'אין לי סדר', 'אין לי שליטה', 'הכל מתערבב', 'אני לא מאורגן', 'לא מסודר', 'בלגן', 'כאוס', 'שום דבר לא ברור', 'אני לא יודע מה קודם למה'];

const MONEY_PHRASES = ['כסף', 'חשבון', 'מינוס', 'חובות', 'הלוואה', 'בנק', 'משכנתא', 'תשלומים', 'אשראי', 'הוצאות', 'אין לי מושג איפה אני עומד', 'בורח מחשבון', 'לא פתחתי דוח', 'מפחד לבדוק'];

const PEOPLE_CONFLICT_PHRASES = ['אני צריך לדבר עם', 'לא דיברתי עם', 'יש מתח עם', 'יש לי עניין עם', 'אני נמנע מלדבר עם', 'יש שיחה שאני דוחה', 'צריך לשים גבול מול', 'אני לא יודע איך להגיד ל'];

const DEEP_NEED_PHRASES = ['אני רוצה כבר', 'בא לי ש', 'אני חייב שינוי', 'אני לא יכול להמשיך ככה', 'נמאס לי', 'די עם זה', 'אני רוצה שקט', 'אני רוצה סדר', 'אני רוצה להרגיש בשליטה'];

const JOURNAL_ONLY_PHRASES = ['יום מחורבן', 'אין לי כוח', 'אני בלחץ', 'אני מרגיש', 'נמאס לי', 'אני עייף', 'אני עצוב', 'אני כועס'];

const FILLER_WORDS = ['אז', 'כאילו', 'אממ', 'אה', 'טוב', 'בבקשה', 'רגע', 'רק', 'פשוט', 'בעצם', 'ממש', 'כזה', 'זה', 'הזה', 'הזאת'];

const TYPE_HINTS: Record<TaskType, string[]> = {
  meeting: ['פגישה', 'ישיבה', 'שיחה', 'זום', 'וידאו', 'ועידה', 'ראיון', 'דייט', 'תיאום'],
  appointment: ['תור', 'רופא', 'רופאה', 'בדיקה', 'מרפאה', 'קליניקה', 'טיפול', 'שיניים', 'שיננית', 'בנק', 'עירייה', 'משרד הפנים', 'קופת חולים'],
  errand: ['לקנות', 'קניות', 'לאסוף', 'להביא', 'להחזיר', 'למסור', 'דואר', 'סופר', 'מכולת', 'מוסך', 'דלק', 'סידור', 'סידורים', 'משלוח'],
  task: ['לעשות', 'לסיים', 'להתחיל', 'לטפל', 'להכין', 'לסדר', 'לארגן', 'למלא', 'להגיש', 'לעדכן', 'לשלוח מייל', 'לשלוח הודעה', 'להתקשר', 'לבדוק', 'לברר'],
  reminder: ['תזכיר לי', 'תזכורת', 'לא לשכוח', 'אל תשכח', 'להזכיר']
};

const LOCATION_TRIGGERS = ['בכתובת', 'כתובת', 'מיקום', 'תתקיים ב', 'מתקיים ב', 'נפגשים ב', 'פגישה ב', 'אצל', 'אצל ה', 'בבית של', 'במשרד', 'בסניף', 'בחנות', 'בקניון', 'במרכז', 'בפארק', 'במגרש', 'במרפאה', 'בקליניקה', 'בבית חולים', 'בתחנה', 'ברחוב', 'רחוב', "רח'", 'בשדרות', 'שדרות', 'בדרך', 'דרך', 'ליד', 'מול', 'על יד', 'מאחורי', 'קומה', 'כניסה', 'חדר', 'דירה', 'בניין', 'מספר', "מס'"];

const PARTICIPANT_TRIGGERS = ['עם', 'מול', 'נפגש עם', 'פגישה עם', 'שיחה עם', 'לקבוע עם', 'לדבר עם', 'להתקשר ל', 'להתקשר עם'];

const SPEECH_VERBS = ['דיברתי', 'נדבר', 'שיחה', 'לטלפון', 'התקשרתי', 'להתקשר', 'שוחחתי', 'התייעצתי'];

const NARRATIVE_VERBS = ['דיברתי', 'אמרתי', 'סיפרתי', 'הסברתי', 'שאלתי', 'התקשרתי', 'נפגשתי', 'הלכתי', 'הייתי'];

const ANGRY_WORDS = ['כועס', 'עצבני', 'נמאס', 'מעצבן', 'לעזאזל'];
const ANXIOUS_WORDS = ['פחד', 'דאגה', 'לחץ', 'מלחיץ', 'חרדה', 'פוחד', 'דואג', 'לחוץ'];
const SAD_WORDS = ['עצוב', 'עצב', 'דיכאון', 'ייאוש', 'בודד', 'נואש'];
const TIRED_WORDS = ['עייף', 'עייפות', 'שינה', 'תשוש', 'מותש', 'אין לי כוח'];
const EXCITED_WORDS = ['מתרגש', 'התרגשות', 'שמח', 'נהדר', 'מעולה'];

const hebrewDays: Record<string, number> = {
  'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3,
  'חמישי': 4, 'שישי': 5, 'שבת': 6
};

function cleanFillerWords(text: string): string {
  let cleaned = text;
  for (const filler of FILLER_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, 'g'), '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function hasTimeOrDateSignal(text: string): boolean {
  const allSignals = [...TIME_SIGNALS, ...DATE_SIGNALS, ...DAYS_OF_WEEK];
  return allSignals.some(signal => text.includes(signal));
}

function hasActionVerb(text: string): boolean {
  return ACTION_VERBS.some(verb => text.includes(verb));
}

function hasReminderTrigger(text: string): boolean {
  return REMINDER_TRIGGERS.some(trigger => text.includes(trigger));
}

function hasCommitment(text: string): boolean {
  return COMMITMENT_WORDS.some(word => text.includes(word));
}

function isJournalOnly(text: string): boolean {
  const hasJournalPhrase = JOURNAL_ONLY_PHRASES.some(phrase => text.includes(phrase));
  const hasNoAction = !hasActionVerb(text) && !hasTimeOrDateSignal(text) && !hasReminderTrigger(text);
  return hasJournalPhrase && hasNoAction;
}

function determineMode(text: string): 'task_or_event' | 'journal_entry' {
  if (hasTimeOrDateSignal(text)) return 'task_or_event';
  if (hasActionVerb(text)) return 'task_or_event';
  if (hasReminderTrigger(text)) return 'task_or_event';
  if (hasCommitment(text) && !isJournalOnly(text)) return 'task_or_event';
  return 'journal_entry';
}

function extractDate(text: string): { date: string | null; time: string | null; end_time: string | null } {
  const now = new Date();
  let date: Date | null = null;
  let time: string | null = null;
  let end_time: string | null = null;

  if (/היום/.test(text)) {
    date = now;
  } else if (/מחרתיים/.test(text)) {
    date = new Date(now);
    date.setDate(date.getDate() + 2);
  } else if (/מחר/.test(text)) {
    date = new Date(now);
    date.setDate(date.getDate() + 1);
  }

  const dayMatch = text.match(/(יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(\s+(הקרוב|הבא))?/);
  if (dayMatch && !date) {
    const targetDay = hebrewDays[dayMatch[2]];
    if (targetDay !== undefined) {
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      date = new Date(now);
      date.setDate(date.getDate() + daysToAdd);
    }
  }

  const inDaysMatch = text.match(/בעוד\s+(\d+)\s*(ימים?|שבועות?|חודשים?)/);
  if (inDaysMatch && !date) {
    const num = parseInt(inDaysMatch[1]);
    date = new Date(now);
    if (inDaysMatch[2].startsWith('יום')) {
      date.setDate(date.getDate() + num);
    } else if (inDaysMatch[2].startsWith('שבוע')) {
      date.setDate(date.getDate() + num * 7);
    } else if (inDaysMatch[2].startsWith('חודש')) {
      date.setMonth(date.getMonth() + num);
    }
  }

  // Check for time range patterns first: "מ12 עד 15", "מהשעה 12 עד 15", "בין 12 ל15"
  const timeRangeMatch = text.match(/(?:מ-?|מהשעה\s*|בין\s*)(\d{1,2})(?::(\d{2}))?\s*(?:עד|ל-?|ו-?)\s*(\d{1,2})(?::(\d{2}))?/);
  if (timeRangeMatch) {
    let startHours = parseInt(timeRangeMatch[1]);
    const startMinutes = timeRangeMatch[2] ? parseInt(timeRangeMatch[2]) : 0;
    let endHours = parseInt(timeRangeMatch[3]);
    const endMinutes = timeRangeMatch[4] ? parseInt(timeRangeMatch[4]) : 0;
    
    // Adjust for PM if mentioned
    if (startHours < 12 && /(בערב|בלילה|אחהצ|אחר הצהריים)/.test(text)) {
      startHours += 12;
      if (endHours < startHours) endHours += 12;
    }
    
    time = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
    end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  } else {
    // Single time extraction
    const timeMatch = text.match(/(?:בשעה\s*|ב-?)(\d{1,2})(?::(\d{2}))?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (hours < 12 && /(בערב|בלילה|אחהצ|אחר הצהריים)/.test(text)) {
        hours += 12;
      }
      time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else if (/בבוקר/.test(text)) {
      time = '09:00';
    } else if (/בצהריים/.test(text)) {
      time = '12:00';
    } else if (/אחהצ|אחר הצהריים/.test(text)) {
      time = '15:00';
    } else if (/בערב/.test(text)) {
      time = '20:00';
    }
  }

  return {
    date: date ? date.toISOString().split('T')[0] : null,
    time,
    end_time
  };
}

function extractTaskType(text: string): TaskType {
  for (const [type, hints] of Object.entries(TYPE_HINTS)) {
    for (const hint of hints) {
      if (text.includes(hint)) {
        return type as TaskType;
      }
    }
  }
  return 'task';
}

function extractPriority(text: string): Priority {
  const highWords = ['דחוף', 'חייב', 'עכשיו', 'היום', 'אסור לשכוח', 'קריטי', 'מיידי', 'בוער'];
  const mediumWords = ['חשוב', 'בהקדם', 'מהר'];
  
  if (highWords.some(w => text.includes(w))) return 'high';
  if (mediumWords.some(w => text.includes(w))) return 'medium';
  return 'low';
}

function extractLocation(text: string): string | null {
  const locationPatterns = [
    /ב(משרד|סניף|חנות|קניון|פארק|מרפאה|קליניקה|בית חולים)\s+([^,\.]+)/,
    /ברחוב\s+([^,\.]+)/,
    /אצל\s+([^,\.]+)/,
    /(ליד|מול|על יד)\s+([^,\.]+)/,
  ];

  for (const pattern of locationPatterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[match.length - 1]?.trim() || null;
    }
  }
  return null;
}

function inferPhoneCallLocation(text: string, participants: string[], explicitLocation: string | null): string | null {
  if (explicitLocation) return explicitLocation;
  
  if (participants.length > 0) {
    const hasSpeechVerb = SPEECH_VERBS.some(v => text.includes(v));
    const hasNoPhysicalLocation = !LOCATION_TRIGGERS.some(trigger => 
      text.includes(trigger) && !['שיחה', 'דיברתי', 'נדבר'].includes(trigger)
    );
    
    if (hasSpeechVerb && hasNoPhysicalLocation) {
      return 'שיחת טלפון';
    }
  }
  
  return null;
}

function isAlreadyScheduled(text: string): boolean {
  const scheduledIndicators = ['קבענו', 'נקבע', 'יש לי', 'מתוכנן', 'נקבעה', 'סיכמנו', 'הוחלט'];
  return scheduledIndicators.some(ind => text.includes(ind));
}

function convertNarrativeToAction(text: string, taskType: TaskType, participants: string[], alreadyScheduled: boolean): string {
  let title = text;
  
  for (const verb of NARRATIVE_VERBS) {
    title = title.replace(new RegExp(`${verb}\\s*(עם|את|ש)?`, 'g'), '');
  }
  
  title = title
    .replace(/וצריך\s*ל/g, 'ל')
    .replace(/ו?אני\s*צריך\s*ל/g, 'ל')
    .replace(/ואמר\s*(לי\s*)?ש/g, '')
    .replace(/ו?הוא\s*אמר/g, '')
    .replace(/ו?היא\s*אמרה/g, '')
    .replace(/איתו|איתה|אתו|אתה/g, '');
  
  const typeToNoun: Record<TaskType, string> = {
    meeting: 'פגישה',
    appointment: 'תור',
    errand: 'סידור',
    task: 'משימה',
    reminder: 'תזכורת'
  };
  
  const typeToVerb: Record<TaskType, string> = {
    meeting: 'לקבוע פגישה',
    appointment: 'לקבוע תור',
    errand: 'לעשות',
    task: 'לעשות',
    reminder: 'תזכורת'
  };
  
  title = title.replace(/\s+/g, ' ').trim();
  
  if (!title || title.length < 3) {
    if (alreadyScheduled) {
      title = typeToNoun[taskType];
    } else {
      title = typeToVerb[taskType];
    }
    if (participants.length > 0) {
      title += ` עם ${participants[0]}`;
    }
  }
  
  return title;
}

function extractParticipants(text: string): string[] {
  const participants: string[] = [];
  const patterns = [
    /עם\s+([א-ת]+(?:\s+[א-ת]+)?)/g,
    /פגישה\s+עם\s+([א-ת]+(?:\s+[א-ת]+)?)/g,
    /שיחה\s+עם\s+([א-ת]+(?:\s+[א-ת]+)?)/g,
    /לדבר\s+עם\s+([א-ת]+(?:\s+[א-ת]+)?)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length > 1 && !participants.includes(name)) {
        participants.push(name);
      }
    }
  }
  return participants;
}

function cleanTitle(text: string, taskType: TaskType, participants: string[], alreadyScheduled: boolean): string {
  let title = text;

  const prefixes = [
    /^תכניס\s*לי\s*משימה\s*/,
    /^אני\s*צריך\s*/,
    /^תזכיר\s*לי\s*/,
    /^צריך\s*ל/,
    /^חייב\s*ל/,
    /^תוסיף\s*/,
    /^להוסיף\s*/,
    /^משימה[:\s]*/,
  ];

  for (const prefix of prefixes) {
    title = title.replace(prefix, '');
  }

  title = title
    .replace(/\s*(מחר|מחרתיים|היום)\s*/g, ' ')
    .replace(/\s*בשעה\s*\d{1,2}(:\d{2})?\s*/g, ' ')
    .replace(/\s*ב-?\d{1,2}(:\d{2})?\s*/g, ' ')
    .replace(/\s*ב(אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת עשרה|שתים עשרה)\s*/g, ' ')
    .replace(/\s*(דחוף|קריטי|חשוב|מיידי)\s*/g, ' ')
    .replace(/\s*(יום\s*)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*(הבא|הקרוב)?\s*/g, ' ')
    .replace(/\s*בעוד\s+\d+\s*(ימים?|שבועות?|חודשים?)\s*/g, ' ')
    .replace(/\s*(בבוקר|בצהריים|בערב|בלילה|אחהצ|אחר הצהריים)\s*/g, ' ')
    .replace(/\s*ב(משרד|סניף|חנות|קניון|פארק|מרפאה|קליניקה)\s+[^,\.]+/g, ' ')
    .replace(/\s*ברחוב\s+[^,\.]+/g, ' ')
    .replace(/\s*אצל\s+[^,\.]+/g, ' ')
    .replace(/\s*(ליד|מול|על יד)\s+[^,\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const filler of FILLER_WORDS) {
    title = title.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '');
  }
  title = title.replace(/\s+/g, ' ').trim();

  title = convertNarrativeToAction(title, taskType, participants, alreadyScheduled);

  title = title
    .replace(/בתאריך\s*\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?/g, '')
    .replace(/\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?/g, '')
    .replace(/מחר\s*בערב|מחר\s*בבוקר|היום\s*בערב|היום\s*בבוקר/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let words = title.split(' ').filter(w => w.length > 0);
  if (words.length > 6) {
    words = words.slice(0, 6);
    title = words.join(' ');
  }

  const typeToNounWithParticipant: Record<TaskType, (p: string) => string> = {
    meeting: (p) => `פגישה עם ${p}`,
    appointment: (p) => `תור עם ${p}`,
    errand: (p) => `סידור עם ${p}`,
    task: (p) => `משימה עם ${p}`,
    reminder: (p) => `תזכורת לגבי ${p}`
  };
  
  const typeToVerbWithParticipant: Record<TaskType, (p: string) => string> = {
    meeting: (p) => `לקבוע פגישה עם ${p}`,
    appointment: (p) => `לקבוע תור עם ${p}`,
    errand: (p) => `לעשות סידור עם ${p}`,
    task: (p) => `לעשות משימה עם ${p}`,
    reminder: (p) => `תזכורת לגבי ${p}`
  };
  
  const typeToNounAlone: Record<TaskType, string> = {
    meeting: 'לקבוע פגישה',
    appointment: 'לקבוע תור',
    errand: 'סידור לעשות',
    task: 'משימה לעשות',
    reminder: 'תזכורת חדשה'
  };
  
  const typeToVerbAlone: Record<TaskType, string> = {
    meeting: 'לקבוע פגישה',
    appointment: 'לקבוע תור',
    errand: 'סידור לעשות',
    task: 'משימה לעשות',
    reminder: 'תזכורת חדשה'
  };

  words = title.split(' ').filter(w => w.length > 0);
  if (words.length < 2) {
    if (participants.length > 0) {
      title = alreadyScheduled 
        ? typeToNounWithParticipant[taskType](participants[0])
        : typeToVerbWithParticipant[taskType](participants[0]);
    } else {
      title = alreadyScheduled ? typeToNounAlone[taskType] : typeToVerbAlone[taskType];
    }
  }

  return title;
}

function detectMood(text: string): MoodHint {
  if (ANGRY_WORDS.some(w => text.includes(w))) return 'angry';
  if (ANXIOUS_WORDS.some(w => text.includes(w))) return 'anxious';
  if (SAD_WORDS.some(w => text.includes(w))) return 'sad';
  if (TIRED_WORDS.some(w => text.includes(w))) return 'tired';
  if (EXCITED_WORDS.some(w => text.includes(w))) return 'excited';
  if (MENTAL_LOAD_PHRASES.some(p => text.includes(p))) return 'stressed';
  return 'neutral';
}

function detectIntensity(text: string): 1 | 2 | 3 | 4 | 5 {
  const severeWords = ['טובע', 'קריסה', 'קורס', 'מתפוצץ', 'נשברתי', 'אין לי כוח'];
  const moderateWords = ['לא כיף', 'קשה', 'מתאמץ', 'עמוס'];
  
  if (severeWords.some(w => text.includes(w))) return 5;
  if (MENTAL_LOAD_PHRASES.some(p => text.includes(p))) return 4;
  if (moderateWords.some(w => text.includes(w))) return 3;
  return 2;
}

function detectJournalTags(text: string): string[] {
  const tags: string[] = [];
  if (MONEY_PHRASES.some(p => text.includes(p))) tags.push('כסף');
  if (PEOPLE_CONFLICT_PHRASES.some(p => text.includes(p))) tags.push('מערכות יחסים');
  if (MENTAL_LOAD_PHRASES.some(p => text.includes(p))) tags.push('עומס');
  if (STUCK_PHRASES.some(p => text.includes(p))) tags.push('תקיעות');
  if (CHAOS_PHRASES.some(p => text.includes(p))) tags.push('סדר');
  if (PROCRASTINATION_PHRASES.some(p => text.includes(p))) tags.push('דחיינות');
  if (TIRED_WORDS.some(w => text.includes(w))) tags.push('שינה');
  return tags;
}

function extractSuggestedTasksFromJournal(text: string): SuggestedTask[] {
  const suggestions: SuggestedTask[] = [];

  if (MONEY_PHRASES.some(p => text.includes(p))) {
    suggestions.push({
      title: 'לעבור על מצב החשבון',
      reason: 'המשתמש דיבר על לחץ או חוסר שליטה בנושאי כסף',
      confidence: 'medium'
    });
  }

  const personMatch = text.match(/לא דיברתי עם\s+([א-ת]+)/);
  if (personMatch) {
    suggestions.push({
      title: `לקבוע שיחה עם ${personMatch[1]}`,
      reason: 'המשתמש הביע הימנעות מתקשורת עם אדם מסוים',
      confidence: 'high'
    });
  }

  if (CHAOS_PHRASES.some(p => text.includes(p))) {
    suggestions.push({
      title: 'לרשום 3 משימות דחופות',
      reason: 'המשתמש דיבר על בלגן וחוסר סדר',
      confidence: 'medium'
    });
  }

  if (PROCRASTINATION_PHRASES.some(p => text.includes(p)) && text.includes('בנק')) {
    suggestions.push({
      title: 'להתקשר לבנק',
      reason: 'המשתמש הביע דחיינות בנושא בנק',
      confidence: 'high'
    });
  }

  if (STUCK_PHRASES.some(p => text.includes(p))) {
    suggestions.push({
      title: 'לכתוב מה הדבר הכי קטן שאפשר לעשות היום',
      reason: 'המשתמש מרגיש תקוע ולא יודע מאיפה להתחיל',
      confidence: 'medium'
    });
  }

  return suggestions.slice(0, 3);
}

function generateJournalTitle(text: string, tags: string[]): string {
  if (tags.includes('כסף')) return 'מחשבות על כסף';
  if (tags.includes('מערכות יחסים')) return 'על מערכות יחסים';
  if (tags.includes('עומס')) return 'לחץ ועומס';
  if (tags.includes('תקיעות')) return 'תחושת תקיעות';
  if (tags.length > 0) return `פריקה על ${tags[0]}`;
  return 'יומן';
}

// Keywords for detecting related tasks
const TASK_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'כביסה': ['כביסה', 'לקפל', 'לתלות', 'מכונת כביסה', 'מייבש', 'בגדים', 'לגהץ', 'ארון בגדים'],
  'ניקיון': ['לנקות', 'ניקיון', 'לשטוף', 'לסדר', 'למרוח', 'לארגן', 'לטאטא', 'שואב אבק'],
  'קניות': ['לקנות', 'קניות', 'סופר', 'חנות', 'מכולת', 'להזמין'],
  'בישול': ['לבשל', 'ארוחה', 'מטבח', 'לאפות', 'אוכל', 'ארוחת'],
  'עבודה': ['עבודה', 'פרויקט', 'מייל', 'פגישה', 'ישיבה', 'משרד'],
  'ילדים': ['ילדים', 'בית ספר', 'גן', 'חוגים', 'שיעורי בית'],
};

function findTaskCategory(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  for (const [category, keywords] of Object.entries(TASK_CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerTitle.includes(kw))) {
      return category;
    }
  }
  return null;
}

function tasksOverlap(
  newStart: Date, 
  newEnd: Date, 
  existingStart: Date, 
  existingEnd: Date
): boolean {
  return newStart < existingEnd && newEnd > existingStart;
}

export function detectConflicts(
  newTaskTitle: string,
  newStartTime: Date,
  newEndTime: Date,
  existingTasks: ExistingTask[]
): ConflictInfo {
  const conflictingTasks: ConflictInfo['conflictingTasks'] = [];
  const newCategory = findTaskCategory(newTaskTitle);
  let isRelated = false;
  let relationReason: string | undefined;
  
  for (const task of existingTasks) {
    const taskStart = new Date(task.startTime);
    const taskEnd = new Date(task.endTime);
    
    if (tasksOverlap(newStartTime, newEndTime, taskStart, taskEnd)) {
      conflictingTasks.push({
        id: task.id,
        title: task.title,
        startTime: task.startTime,
        endTime: task.endTime,
      });
      
      // Check if tasks are related
      const taskCategory = findTaskCategory(task.title);
      if (newCategory && taskCategory && newCategory === taskCategory) {
        isRelated = true;
        relationReason = `שתי המשימות קשורות ל${newCategory}`;
      }
    }
  }
  
  if (conflictingTasks.length === 0) {
    return { hasConflict: false, conflictingTasks: [], isRelated: false };
  }
  
  // Build reorganization question
  let reorganizationQuestion: string;
  
  if (isRelated) {
    const taskNames = [newTaskTitle, ...conflictingTasks.map(t => t.title)].join(' ו');
    reorganizationQuestion = `ראיתי שיש חפיפה בין משימות שקשורות ל${relationReason?.split('ל')[1] || 'נושא דומה'}:\n• ${newTaskTitle}\n• ${conflictingTasks.map(t => t.title).join('\n• ')}\n\nאיזו משימה צריכה להיות קודם? וכמה זמן לוקחת כל אחת?`;
  } else {
    reorganizationQuestion = `יש חפיפה בלוח הזמנים:\n• "${newTaskTitle}" מתנגש עם "${conflictingTasks[0].title}"\n\nאיזו משימה קודמת? וכמה זמן כל אחת לוקחת?`;
  }
  
  return {
    hasConflict: true,
    conflictingTasks,
    isRelated,
    relationReason,
    reorganizationQuestion,
  };
}

export function interpretInput(text: string): InterpretResult {
  const normalizedText = cleanFillerWords(text.trim());
  const mode = determineMode(normalizedText);
  
  const learning_log: LearningLog = {
    new_time_phrases: [],
    new_date_phrases: [],
    new_location_phrases: [],
    new_intent_phrases: [],
    new_task_phrases: [],
    new_emotion_phrases: [],
    unclassified_phrases: []
  };

  if (mode === 'task_or_event') {
    const { date, time, end_time } = extractDate(normalizedText);
    const taskType = extractTaskType(normalizedText);
    const participants = extractParticipants(normalizedText);
    const explicitLocation = extractLocation(normalizedText);
    const alreadyScheduled = isAlreadyScheduled(normalizedText);
    const title = cleanTitle(normalizedText, taskType, participants, alreadyScheduled);
    const priority = extractPriority(normalizedText);
    
    const location = inferPhoneCallLocation(normalizedText, participants, explicitLocation);
    
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (!date && !time) confidence = 'medium';
    if ((taskType === 'meeting' || taskType === 'appointment') && !date) confidence = 'low';

    let needs_clarification = false;
    let clarifying_question: string | null = null;

    if ((taskType === 'meeting' || taskType === 'appointment') && !date && !time) {
      needs_clarification = true;
      clarifying_question = 'מתי זה אמור להיות?';
    }

    const hasEmotionalLoad = MENTAL_LOAD_PHRASES.some(p => normalizedText.includes(p));
    const notes = hasEmotionalLoad ? 'זוהה עומס רגשי' : null;

    const task: TaskOutput = {
      title,
      start_date: date,
      start_time: time,
      end_date: date,
      end_time: end_time,
      all_day: !time,
      location,
      participants,
      type: taskType,
      priority,
      flexibility: date ? 'fixed' : 'flexible',
      notes,
      source: 'voice',
      confidence,
      needs_clarification,
      clarifying_question
    };

    return {
      mode,
      task,
      journal: null,
      suggested_tasks_from_journal: [],
      learning_log
    };
  } else {
    const tags = detectJournalTags(normalizedText);
    const mood_hint = detectMood(normalizedText);
    const intensity = detectIntensity(normalizedText);
    const title = generateJournalTitle(normalizedText, tags);
    const suggested_tasks = extractSuggestedTasksFromJournal(normalizedText);

    const now = new Date();
    const timestamp_local = now.toISOString().slice(0, 16);

    const journal: JournalOutput = {
      title,
      entry_text: text.trim(),
      timestamp_local,
      tags,
      mood_hint,
      intensity,
      action_suggestion: suggested_tasks.length > 0 ? 'רוצה שאעזור להפוך את זה לצעד קטן להיום?' : null
    };

    return {
      mode,
      task: null,
      journal,
      suggested_tasks_from_journal: suggested_tasks,
      learning_log
    };
  }
}
