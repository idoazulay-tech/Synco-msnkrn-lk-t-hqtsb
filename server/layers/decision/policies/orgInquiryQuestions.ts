import { ExpectedAnswerType } from '../types/decisionTypes.js';

export type InquiryReason = 'missing_info' | 'conflict' | 'related_tasks' | 'time_clarification';

export interface OrgQuestion {
  id: string;
  textHebrew: string;
  options?: string[];
  expectedAnswerType: ExpectedAnswerType;
  relatedEntityId?: string;
}

export interface OrgInquiry {
  id: string;
  createdAtIso: string;
  status: 'pending' | 'resolved';
  reason: InquiryReason;
  entity: {
    type: 'task' | 'event';
    id: string;
    title: string;
  };
  message: {
    titleHebrew: string;
    bodyHebrew: string;
  };
  question: OrgQuestion;
  meta: {
    missingInfo: string[];
    conflictId?: string;
    relatedIds?: string[];
  };
}

export interface EntityInfo {
  id: string;
  type: 'task' | 'event';
  title: string;
  date?: string;
  time?: string;
  duration?: number;
}

export interface ConflictInfo {
  conflictingTaskIds: string[];
  conflictingTaskTitles: string[];
  isRelated: boolean;
  relationReason?: string;
}

export function buildInquiryForMissingInfo(
  entity: EntityInfo,
  missingInfo: string[],
  conflictInfo?: ConflictInfo
): Omit<OrgInquiry, 'id' | 'createdAtIso' | 'status'> {
  const question = selectSmartQuestion(entity, missingInfo, conflictInfo);
  const reason = determineReason(missingInfo, conflictInfo);
  
  return {
    reason,
    entity: {
      type: entity.type,
      id: entity.id,
      title: entity.title,
    },
    message: {
      titleHebrew: buildMessageTitle(entity, reason),
      bodyHebrew: buildMessageBody(entity, missingInfo, conflictInfo),
    },
    question,
    meta: {
      missingInfo,
      conflictId: conflictInfo?.conflictingTaskIds?.[0],
      relatedIds: conflictInfo?.conflictingTaskIds,
    },
  };
}

function determineReason(missingInfo: string[], conflictInfo?: ConflictInfo): InquiryReason {
  if (conflictInfo?.isRelated) return 'related_tasks';
  if (conflictInfo && conflictInfo.conflictingTaskIds.length > 0) return 'conflict';
  if (missingInfo.includes('time_ambiguity')) return 'time_clarification';
  return 'missing_info';
}

function selectSmartQuestion(
  entity: EntityInfo,
  missingInfo: string[],
  conflictInfo?: ConflictInfo
): OrgQuestion {
  if (missingInfo.includes('time') || missingInfo.includes('start_time')) {
    return {
      id: crypto.randomUUID(),
      textHebrew: `באיזה שעה לשבץ את "${entity.title}"?`,
      options: ['עכשיו', 'בעוד 20 דק', '14:00', '16:00', '20:00'],
      expectedAnswerType: 'time',
      relatedEntityId: entity.id,
    };
  }

  if (missingInfo.includes('date')) {
    return {
      id: crypto.randomUUID(),
      textHebrew: `לאיזה יום זה - "${entity.title}"?`,
      options: ['היום', 'מחר', 'מחרתיים'],
      expectedAnswerType: 'date',
      relatedEntityId: entity.id,
    };
  }

  if (missingInfo.includes('duration')) {
    return {
      id: crypto.randomUUID(),
      textHebrew: `כמה זמן לוקח לך לסיים את "${entity.title}"?`,
      options: ['5 דק', '10 דק', '20 דק', 'חצי שעה', 'שעה'],
      expectedAnswerType: 'duration',
      relatedEntityId: entity.id,
    };
  }

  if (missingInfo.includes('time_ambiguity')) {
    return {
      id: crypto.randomUUID(),
      textHebrew: `כשאמרת ${entity.time || 'השעה'}, למה התכוונת?`,
      options: ['בבוקר', 'בצהריים', 'אחהצ', 'בערב'],
      expectedAnswerType: 'choice',
      relatedEntityId: entity.id,
    };
  }

  if (conflictInfo && conflictInfo.conflictingTaskIds.length > 0) {
    if (conflictInfo.isRelated) {
      return {
        id: crypto.randomUUID(),
        textHebrew: `יש חפיפה עם משימות קשורות: ${conflictInfo.conflictingTaskTitles.join(', ')}.\nאיזו משימה קודמת? וכמה זמן כל אחת לוקחת?`,
        options: [],
        expectedAnswerType: 'free_text',
        relatedEntityId: entity.id,
      };
    }
    
    return {
      id: crypto.randomUUID(),
      textHebrew: `יש חפיפה עם: ${conflictInfo.conflictingTaskTitles.join(', ')}.\nאיזו משימה קודמת?`,
      options: [entity.title, ...conflictInfo.conflictingTaskTitles],
      expectedAnswerType: 'choice',
      relatedEntityId: entity.id,
    };
  }

  return {
    id: crypto.randomUUID(),
    textHebrew: `יש לי שאלה לגבי "${entity.title}". מה עוד אתה יכול לספר לי?`,
    options: [],
    expectedAnswerType: 'free_text',
    relatedEntityId: entity.id,
  };
}

function buildMessageTitle(entity: EntityInfo, reason: InquiryReason): string {
  switch (reason) {
    case 'missing_info':
      return `צריך פרטים ל"${entity.title}"`;
    case 'conflict':
      return `חפיפה ב"${entity.title}"`;
    case 'related_tasks':
      return `משימות קשורות - "${entity.title}"`;
    case 'time_clarification':
      return `הבהרת זמן - "${entity.title}"`;
    default:
      return `שאלה לגבי "${entity.title}"`;
  }
}

function buildMessageBody(
  entity: EntityInfo,
  missingInfo: string[],
  conflictInfo?: ConflictInfo
): string {
  if (conflictInfo?.isRelated) {
    return `זיהיתי שיש משימות קשורות שחופפות. ${conflictInfo.relationReason || 'אני צריכה לדעת את הסדר הנכון.'}`;
  }
  
  if (conflictInfo && conflictInfo.conflictingTaskIds.length > 0) {
    return `המשימה "${entity.title}" חופפת עם משימות קיימות. צריך לארגן את הסדר.`;
  }
  
  const missingLabels: Record<string, string> = {
    time: 'שעה',
    date: 'תאריך',
    duration: 'משך זמן',
    start_time: 'שעת התחלה',
    end_time: 'שעת סיום',
  };
  
  const missing = missingInfo
    .map(info => missingLabels[info] || info)
    .join(', ');
  
  return `חסר לי מידע כדי לשבץ את "${entity.title}": ${missing}`;
}

export function getNextQuestionForEntity(
  entity: EntityInfo,
  currentMissingInfo: string[],
  answeredQuestions: string[] = []
): OrgQuestion | null {
  const remainingMissing = currentMissingInfo.filter(
    info => !answeredQuestions.includes(info)
  );
  
  if (remainingMissing.length === 0) return null;
  
  const priorityOrder = ['time', 'start_time', 'date', 'duration', 'time_ambiguity'];
  
  for (const priority of priorityOrder) {
    if (remainingMissing.includes(priority)) {
      return selectSmartQuestion(entity, [priority]);
    }
  }
  
  return selectSmartQuestion(entity, remainingMissing);
}
