export type Intent = 
  | 'CREATE_TASK'
  | 'FREE_TEXT'
  | 'MOVE_TASK'
  | 'SCHEDULE_TASK'
  | 'COMPLETE_TASK'
  | 'DEFER_TASK'
  | 'UNKNOWN';

export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ExtractedData {
  title?: string;
  dueAt?: Date;
  urgency?: Urgency;
  entities?: string[];
  duration?: number;
}

export interface InterpretResult {
  intent: Intent;
  extracted: ExtractedData;
  autoAction: boolean;
  needsApproval: boolean;
  questions?: string[];
  insights: {
    summary: string;
    detected: Record<string, unknown>;
  };
}

interface UserContext {
  currentTaskId?: string;
  lastActivity?: Date;
  preferences?: Record<string, unknown>;
}

const TASK_PATTERNS = [
  /תכניס\s*לי\s*משימה/,
  /אני\s*צריך/,
  /תזכיר\s*לי/,
  /צריך\s*ל/,
  /חייב\s*ל/,
  /לעשות/,
  /משימה[:\s]/,
  /תוסיף/,
  /להוסיף/,
];

const CRITICAL_PATTERNS = [
  /דחוף/,
  /חייב\s*עכשיו/,
  /קריטי/,
  /מיידי/,
  /אורגנטי/,
  /בוער/,
  /חירום/,
];

const HIGH_PATTERNS = [
  /חשוב/,
  /מהר/,
  /בהקדם/,
  /היום/,
];

const COMPLETE_PATTERNS = [
  /סיימתי/,
  /עשיתי/,
  /בוצע/,
  /הושלם/,
  /גמרתי/,
];

const DEFER_PATTERNS = [
  /דחה/,
  /תעביר/,
  /לא עכשיו/,
  /אחר\s*כך/,
  /מאוחר\s*יותר/,
];

const SCHEDULE_PATTERNS = [
  /תקבע/,
  /לתזמן/,
  /בשעה/,
  /ביום/,
  /מחר/,
  /מחרתיים/,
];

const hebrewDays: Record<string, number> = {
  'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3,
  'חמישי': 4, 'שישי': 5, 'שבת': 6
};

function extractDate(text: string): Date | undefined {
  const now = new Date();
  
  if (/היום/.test(text)) {
    return now;
  }
  
  if (/מחרתיים/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 2);
    return date;
  }
  
  if (/מחר/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return date;
  }
  
  const dayMatch = text.match(/יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
  if (dayMatch) {
    const targetDay = hebrewDays[dayMatch[1]];
    const currentDay = now.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const date = new Date(now);
    date.setDate(date.getDate() + daysToAdd);
    return date;
  }
  
  const timeMatch = text.match(/(?:בשעה\s*|ב-?)(\d{1,2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const date = new Date(now);
    date.setHours(hours, minutes, 0, 0);
    if (date < now) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }
  
  return undefined;
}

function extractUrgency(text: string): Urgency {
  if (CRITICAL_PATTERNS.some(p => p.test(text))) return 'CRITICAL';
  if (HIGH_PATTERNS.some(p => p.test(text))) return 'HIGH';
  return 'MEDIUM';
}

function extractTitle(text: string): string {
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
    .replace(/\s*(דחוף|קריטי|חשוב|מיידי)\s*/g, ' ')
    .trim();
  
  return title || text.slice(0, 50);
}

function detectIntent(text: string): Intent {
  if (COMPLETE_PATTERNS.some(p => p.test(text))) return 'COMPLETE_TASK';
  if (DEFER_PATTERNS.some(p => p.test(text))) return 'DEFER_TASK';
  if (SCHEDULE_PATTERNS.some(p => p.test(text))) return 'SCHEDULE_TASK';
  if (TASK_PATTERNS.some(p => p.test(text))) return 'CREATE_TASK';
  
  const hasActionableWords = /צריך|חייב|לעשות|להכין|לשלוח|להתקשר|לקנות|לבדוק/.test(text);
  if (hasActionableWords) return 'CREATE_TASK';
  
  return 'FREE_TEXT';
}

function generateQuestions(intent: Intent, extracted: ExtractedData): string[] {
  const questions: string[] = [];
  
  if (intent === 'CREATE_TASK') {
    if (!extracted.dueAt) {
      questions.push('מתי תרצה לבצע את המשימה?');
    }
    if (!extracted.title || extracted.title.length < 5) {
      questions.push('תוכל לפרט יותר מה המשימה?');
    }
  }
  
  if (intent === 'FREE_TEXT') {
    questions.push('האם זו משימה שצריך לבצע?');
    questions.push('או שזו מחשבה שרצית לשמור?');
  }
  
  return questions;
}

function generateSummary(intent: Intent, extracted: ExtractedData, text: string): string {
  switch (intent) {
    case 'CREATE_TASK':
      if (extracted.dueAt) {
        return `זיהיתי משימה: "${extracted.title}" לביצוע ב-${extracted.dueAt.toLocaleDateString('he-IL')}`;
      }
      return `זיהיתי משימה: "${extracted.title}"`;
    
    case 'COMPLETE_TASK':
      return 'הבנתי שסיימת משימה';
    
    case 'DEFER_TASK':
      return 'הבנתי שרוצה לדחות משימה';
    
    case 'SCHEDULE_TASK':
      return 'הבנתי שרוצה לתזמן משימה';
    
    case 'FREE_TEXT':
      return `קיבלתי את המחשבה: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`;
    
    default:
      return 'לא הצלחתי להבין לגמרי, אפשר לפרט?';
  }
}

export function interpretInput(text: string, userContext?: UserContext): InterpretResult {
  const normalizedText = text.trim();
  
  const intent = detectIntent(normalizedText);
  const urgency = extractUrgency(normalizedText);
  const dueAt = extractDate(normalizedText);
  const title = extractTitle(normalizedText);
  
  const extracted: ExtractedData = {
    title,
    dueAt,
    urgency,
  };
  
  const questions = generateQuestions(intent, extracted);
  const summary = generateSummary(intent, extracted, normalizedText);
  
  const autoAction = intent === 'CREATE_TASK' && !!dueAt && urgency !== 'CRITICAL';
  const needsApproval = intent === 'CREATE_TASK' && !dueAt;
  
  return {
    intent,
    extracted,
    autoAction,
    needsApproval,
    questions: questions.length > 0 ? questions : undefined,
    insights: {
      summary,
      detected: {
        originalText: normalizedText,
        detectedIntent: intent,
        detectedUrgency: urgency,
        hasDate: !!dueAt,
        hasTime: /\d{1,2}:\d{2}/.test(normalizedText),
        wordCount: normalizedText.split(/\s+/).length,
        timestamp: new Date().toISOString(),
      }
    }
  };
}
