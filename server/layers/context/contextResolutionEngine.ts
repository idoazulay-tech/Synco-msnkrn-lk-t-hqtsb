import {
  ActiveQuestionContext,
  QuestionGoal,
  NewEvidence,
  ContextResolutionResult,
  createActiveContext,
  getActiveContextForEntity,
  getLatestUnresolvedContext,
  resolveContext,
  getContextChain
} from './activeQuestionContext';

const TIME_PATTERNS = [
  /(\d{1,2}):(\d{2})/,
  /בשעה\s*(\d{1,2})/,
  /ב-?(\d{1,2})/,
  /(\d{1,2})\s*(בבוקר|בצהריים|בערב|בלילה)/
];

const DATE_PATTERNS = [
  /היום/,
  /מחר/,
  /מחרתיים/,
  /יום\s*(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/,
  /בעוד\s*(\d+)\s*(ימים?|שבועות?)/,
  /ב-?(\d{1,2})[\/.-](\d{1,2})/
];

const DURATION_PATTERNS = [
  /(\d+)\s*(דקות?|שעות?|שעה)/,
  /חצי\s*שעה/,
  /רבע\s*שעה/
];

const TIME_OF_DAY_MAP: Record<string, { start: string; end: string }> = {
  'בבוקר': { start: '08:00', end: '12:00' },
  'בצהריים': { start: '12:00', end: '14:00' },
  'אחהצ': { start: '14:00', end: '18:00' },
  'אחר הצהריים': { start: '14:00', end: '18:00' },
  'בערב': { start: '18:00', end: '22:00' },
  'בלילה': { start: '22:00', end: '00:00' }
};

export function processAnswerInContext(
  answer: string,
  entityId?: string
): ContextResolutionResult {
  const context = entityId 
    ? getActiveContextForEntity(entityId) 
    : getLatestUnresolvedContext();
  
  if (!context) {
    return {
      goalAchieved: false,
      extractedEvidence: [],
      nextAction: 'wait'
    };
  }
  
  const extractedEvidence = extractAllPossibleEvidence(answer, context);
  
  const goalAchieved = checkGoalAchievement(context, extractedEvidence);
  
  if (goalAchieved) {
    resolveContext(context.id);
    return {
      goalAchieved: true,
      extractedEvidence,
      nextAction: 'execute'
    };
  }
  
  const followup = generateFollowupQuestion(context, extractedEvidence);
  
  return {
    goalAchieved: false,
    extractedEvidence,
    nextAction: 'ask_followup',
    followupQuestion: followup.question,
    followupGoal: followup.goal
  };
}

function extractAllPossibleEvidence(
  answer: string,
  context: ActiveQuestionContext
): NewEvidence[] {
  const evidence: NewEvidence[] = [];
  const normalizedAnswer = answer.trim();
  
  const timeEvidence = extractTimeEvidence(normalizedAnswer);
  if (timeEvidence) {
    evidence.push(timeEvidence);
  }
  
  const dateEvidence = extractDateEvidence(normalizedAnswer);
  if (dateEvidence) {
    evidence.push(dateEvidence);
  }
  
  const durationEvidence = extractDurationEvidence(normalizedAnswer);
  if (durationEvidence) {
    evidence.push(durationEvidence);
  }
  
  const preferenceEvidence = extractPreferenceEvidence(normalizedAnswer);
  if (preferenceEvidence) {
    evidence.push(preferenceEvidence);
  }
  
  const statusEvidence = extractStatusEvidence(normalizedAnswer);
  if (statusEvidence) {
    evidence.push(statusEvidence);
  }
  
  const conflictEvidence = extractConflictResolution(normalizedAnswer);
  if (conflictEvidence) {
    evidence.push(conflictEvidence);
  }
  
  if (evidence.length === 0 && normalizedAnswer.length > 0) {
    evidence.push({
      type: 'preference',
      value: normalizedAnswer,
      confidence: 0.5,
      source: 'user_answer',
      extractedAt: new Date()
    });
  }
  
  return evidence;
}

function extractTimeEvidence(answer: string): NewEvidence | null {
  for (const pattern of TIME_PATTERNS) {
    const match = answer.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      
      if (match[3]) {
        const period = match[3];
        if ((period === 'בערב' || period === 'בלילה') && hours < 12) {
          hours += 12;
        }
      }
      
      return {
        type: 'time',
        value: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        confidence: 0.9,
        source: 'user_answer',
        extractedAt: new Date()
      };
    }
  }
  
  for (const [keyword, times] of Object.entries(TIME_OF_DAY_MAP)) {
    if (answer.includes(keyword)) {
      return {
        type: 'time',
        value: times.start,
        confidence: 0.7,
        source: 'user_answer',
        extractedAt: new Date()
      };
    }
  }
  
  return null;
}

function extractDateEvidence(answer: string): NewEvidence | null {
  if (answer.includes('היום')) {
    return {
      type: 'date',
      value: 'today',
      confidence: 0.95,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  if (answer.includes('מחר')) {
    return {
      type: 'date',
      value: 'tomorrow',
      confidence: 0.95,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  if (answer.includes('מחרתיים')) {
    return {
      type: 'date',
      value: 'day_after_tomorrow',
      confidence: 0.95,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  const dayMatch = answer.match(/יום\s*(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
  if (dayMatch) {
    return {
      type: 'date',
      value: `day_${dayMatch[1]}`,
      confidence: 0.9,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  const dateMatch = answer.match(/ב-?(\d{1,2})[\/.-](\d{1,2})/);
  if (dateMatch) {
    return {
      type: 'date',
      value: `${dateMatch[1]}/${dateMatch[2]}`,
      confidence: 0.9,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  return null;
}

function extractDurationEvidence(answer: string): NewEvidence | null {
  if (answer.includes('חצי שעה')) {
    return {
      type: 'duration',
      value: '30',
      confidence: 0.95,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  if (answer.includes('רבע שעה')) {
    return {
      type: 'duration',
      value: '15',
      confidence: 0.95,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  const hourMatch = answer.match(/(\d+)\s*(שעות?|שעה)/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    return {
      type: 'duration',
      value: (hours * 60).toString(),
      confidence: 0.9,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  const minuteMatch = answer.match(/(\d+)\s*דקות?/);
  if (minuteMatch) {
    return {
      type: 'duration',
      value: minuteMatch[1],
      confidence: 0.9,
      source: 'user_answer',
      extractedAt: new Date()
    };
  }
  
  return null;
}

function extractPreferenceEvidence(answer: string): NewEvidence | null {
  const orderPatterns = [
    { pattern: /קודם|לפני|ראשון/, value: 'first' },
    { pattern: /אחרי|אחר כך|שני/, value: 'second' },
    { pattern: /בסוף|אחרון/, value: 'last' }
  ];
  
  for (const { pattern, value } of orderPatterns) {
    if (pattern.test(answer)) {
      return {
        type: 'order',
        value,
        confidence: 0.8,
        source: 'user_answer',
        extractedAt: new Date()
      };
    }
  }
  
  return null;
}

function extractStatusEvidence(answer: string): NewEvidence | null {
  const statusPatterns = [
    { pattern: /סיימתי|עשיתי|בוצע|גמרתי/, value: 'completed' },
    { pattern: /לא עשיתי|לא הספקתי|דחיתי/, value: 'not_completed' },
    { pattern: /בתהליך|עובד על|באמצע/, value: 'in_progress' },
    { pattern: /ביטול|לבטל|מבוטל/, value: 'cancelled' }
  ];
  
  for (const { pattern, value } of statusPatterns) {
    if (pattern.test(answer)) {
      return {
        type: 'status',
        value,
        confidence: 0.85,
        source: 'user_answer',
        extractedAt: new Date()
      };
    }
  }
  
  return null;
}

function extractConflictResolution(answer: string): NewEvidence | null {
  const conflictPatterns = [
    { pattern: /להזיז|לדחות/, value: 'reschedule' },
    { pattern: /לבטל|למחוק/, value: 'cancel' },
    { pattern: /להשאיר|בסדר כך/, value: 'keep' },
    { pattern: /לפצל|לחלק/, value: 'split' }
  ];
  
  for (const { pattern, value } of conflictPatterns) {
    if (pattern.test(answer)) {
      return {
        type: 'conflict_resolution',
        value,
        confidence: 0.85,
        source: 'user_answer',
        extractedAt: new Date()
      };
    }
  }
  
  return null;
}

function checkGoalAchievement(
  context: ActiveQuestionContext,
  evidence: NewEvidence[]
): boolean {
  const goalToEvidenceType: Record<QuestionGoal, string[]> = {
    'resolve_time': ['time'],
    'resolve_date': ['date'],
    'resolve_duration': ['duration'],
    'resolve_order': ['order', 'preference'],
    'resolve_conflict': ['conflict_resolution'],
    'resolve_status': ['status'],
    'resolve_title': ['preference']
  };
  
  const requiredTypes = goalToEvidenceType[context.questionGoal] || [];
  
  return requiredTypes.some(type => 
    evidence.some(e => e.type === type && e.confidence >= 0.5)
  );
}

function generateFollowupQuestion(
  context: ActiveQuestionContext,
  extractedEvidence: NewEvidence[]
): { question: string; goal: QuestionGoal } {
  const collectedInfo = extractedEvidence.map(e => e.type as string);
  const remainingMissing = context.missingInfo.filter(
    info => !collectedInfo.includes(info)
  );
  
  if (remainingMissing.length === 0) {
    return {
      question: 'האם אפשר לסכם ולקבוע?',
      goal: context.questionGoal
    };
  }
  
  const nextMissing = remainingMissing[0];
  
  const followupQuestions: Record<string, { question: string; goal: QuestionGoal }> = {
    'time': { question: 'באיזו שעה?', goal: 'resolve_time' },
    'date': { question: 'באיזה יום?', goal: 'resolve_date' },
    'duration': { question: 'כמה זמן זה ייקח?', goal: 'resolve_duration' },
    'order': { question: 'מה הסדר?', goal: 'resolve_order' },
    'status': { question: 'מה המצב?', goal: 'resolve_status' }
  };
  
  return followupQuestions[nextMissing] || {
    question: 'צריך עוד פרטים?',
    goal: context.questionGoal
  };
}

export function applyEvidenceToEntity(
  entityId: string,
  evidence: NewEvidence[]
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  
  for (const e of evidence) {
    switch (e.type) {
      case 'time':
        updates.time = e.value;
        break;
      case 'date':
        updates.date = resolveDateValue(e.value);
        break;
      case 'duration':
        updates.duration = parseInt(e.value);
        break;
      case 'status':
        updates.status = e.value;
        break;
      case 'order':
        updates.order = e.value;
        break;
      case 'conflict_resolution':
        updates.conflictAction = e.value;
        break;
    }
  }
  
  return updates;
}

function resolveDateValue(value: string): string {
  const now = new Date();
  
  if (value === 'today') {
    return now.toISOString().split('T')[0];
  }
  
  if (value === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  if (value === 'day_after_tomorrow') {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter.toISOString().split('T')[0];
  }
  
  if (value.startsWith('day_')) {
    const dayName = value.replace('day_', '');
    const dayMap: Record<string, number> = {
      'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3,
      'חמישי': 4, 'שישי': 5, 'שבת': 6
    };
    const targetDay = dayMap[dayName];
    if (targetDay !== undefined) {
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  return value;
}

export {
  createActiveContext,
  getActiveContextForEntity,
  getLatestUnresolvedContext,
  resolveContext,
  getContextChain
};
