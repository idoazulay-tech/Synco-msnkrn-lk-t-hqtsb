// PATCH 3: Task Type Classifier - Rule-based classification for stable situationKeys

export type TaskType = 'cooking' | 'dishes' | 'shopping' | 'work' | 'home' | 'health' | 'dog' | 'general';

interface ClassificationRule {
  type: TaskType;
  keywords: string[];
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    type: 'cooking',
    keywords: ['לבשל', 'להכין אוכל', 'ארוחה', 'בישול', 'מתכון', 'להכין ארוחה', 'לאפות']
  },
  {
    type: 'dishes',
    keywords: ['כלים', 'לשטוף', 'מדיח', 'כלי מטבח', 'לנקות כלים']
  },
  {
    type: 'shopping',
    keywords: ['לקנות', 'קניות', 'סופר', 'מכולת', 'קניון', 'חנות']
  },
  {
    type: 'work',
    keywords: ['עבודה', 'פגישה', 'ישיבה', 'מייל', 'דוח', 'פרויקט', 'לקוח', 'משרד', 'זום', 'שיחה עם']
  },
  {
    type: 'home',
    keywords: ['לנקות', 'בית', 'סדר', 'לסדר', 'כביסה', 'לארגן', 'ניקיון', 'לקפל']
  },
  {
    type: 'health',
    keywords: ['רופא', 'תרופה', 'תרופות', 'בדיקה', 'רפואה', 'טיפול', 'מרפאה', 'בריאות']
  },
  {
    type: 'dog',
    keywords: ['קיטו', 'כלב', 'טיול', 'הכלב', 'וטרינר', 'לטייל עם', 'האכלה']
  }
];

export function classifyTaskType(title: string): TaskType {
  const normalizedTitle = title.toLowerCase();
  
  for (const rule of CLASSIFICATION_RULES) {
    for (const keyword of rule.keywords) {
      if (normalizedTitle.includes(keyword)) {
        return rule.type;
      }
    }
  }
  
  return 'general';
}

export function buildSituationKey(context: {
  conflictType?: string;
  taskType1?: TaskType;
  taskType2?: TaskType;
  action?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}): string {
  const parts: string[] = [];
  
  if (context.conflictType) {
    parts.push(`conflict:${context.conflictType}`);
  }
  
  if (context.taskType1) {
    parts.push(`type1=${context.taskType1}`);
  }
  
  if (context.taskType2) {
    parts.push(`type2=${context.taskType2}`);
  }
  
  if (context.action) {
    parts.push(`action=${context.action}`);
  }
  
  if (context.timeOfDay) {
    parts.push(`time=${context.timeOfDay}`);
  }
  
  return parts.join(':');
}

export function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
