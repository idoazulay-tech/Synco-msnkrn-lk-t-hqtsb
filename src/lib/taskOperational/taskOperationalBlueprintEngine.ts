import { Task } from '@/types/task';
import { OperationalBlueprint, SuggestedBreakdown } from '@/types/taskReport';

interface BlueprintInput {
  task: Task;
  selectedOption: string;
  freeText?: string;
  settings?: Record<string, unknown>;
  dayContext?: Record<string, unknown>;
}

type KnownTaskType =
  | 'laundry'
  | 'dishes'
  | 'email'
  | 'phone_call'
  | 'grocery'
  | 'cleaning'
  | 'dog_walk'
  | 'meeting'
  | 'document'
  | 'generic_task';

interface TaskPattern {
  type: KnownTaskType;
  keywords: string[];
  goal: string;
  expectedOutcome: string;
  resourcesNeeded: string[];
  steps: string[];
  assumptions: string[];
}

const TASK_PATTERNS: TaskPattern[] = [
  {
    type: 'laundry',
    keywords: ['כביסה', 'לתלות', 'להוציא', 'מכונת כביסה', 'אטבים', 'לקפל', 'לגהץ'],
    goal: 'לסיים את הכביסה ולהחזיר בגדים נקיים לשימוש',
    expectedOutcome: 'בגדים נקיים ומסודרים',
    resourcesNeeded: ['סל כביסה', 'מקום תלייה', 'אטבים אם צריך'],
    steps: [
      'להכין סל כביסה',
      'לפתוח את המכונה',
      'להעביר את הכביסה לסל',
      'לקחת את הסל לאזור התלייה',
      'לבדוק שיש מקום לתלות',
      'לתלות את הכביסה',
    ],
    assumptions: ['הכביסה כבר סיימה במכונה'],
  },
  {
    type: 'dishes',
    keywords: ['כלים', 'לשטוף', 'מדיח', 'ניקוי מטבח', 'שטיפת'],
    goal: 'לנקות את הכלים המלוכלכים',
    expectedOutcome: 'כלים נקיים ומסודרים',
    resourcesNeeded: ['סבון כלים', 'ספוג', 'מגבת'],
    steps: ['לאסוף כלים מלוכלכים', 'להרטיב', 'לשטוף עם סבון', 'לשטוף במים', 'לייבש'],
    assumptions: ['יש מים וסבון'],
  },
  {
    type: 'email',
    keywords: ['מייל', 'אימייל', 'לשלוח', 'להשיב', 'תגובה', 'פנייה', 'כתיבת', 'email'],
    goal: 'לשלוח או להשיב למייל',
    expectedOutcome: 'מייל נשלח בצורה ברורה',
    resourcesNeeded: ['מחשב או טלפון', 'כתובת המייל'],
    steps: [
      'לפתוח את תוכנת המייל',
      'לזהות את הנמען',
      'לכתוב נושא ברור',
      'לכתוב את תוכן המייל',
      'לבדוק שגיאות',
      'לשלוח',
    ],
    assumptions: ['יש גישה לאינטרנט'],
  },
  {
    type: 'phone_call',
    keywords: ['להתקשר', 'שיחה', 'לדבר עם', 'טלפון', 'לצלצל'],
    goal: 'לקיים שיחת טלפון',
    expectedOutcome: 'שיחה הסתיימה, המידע הועבר',
    resourcesNeeded: ['טלפון', 'מספר הטלפון'],
    steps: ['לאתר את מספר הטלפון', 'לוודא רגע שקט', 'להתקשר', 'לנהל שיחה', 'לסכם ולרשום עיקרים'],
    assumptions: ['האדם האחר זמין'],
  },
  {
    type: 'grocery',
    keywords: ['קניות', 'סופר', 'מכולת', 'לקנות', 'רשימת קניות', 'מזון'],
    goal: 'לסיים קניות מוצרים נחוצים',
    expectedOutcome: 'המוצרים הנדרשים נמצאים בבית',
    resourcesNeeded: ['רשימת קניות', 'ארנק', 'תיק'],
    steps: [
      'להכין רשימת קניות',
      'לוודא תשלום',
      'להגיע לחנות',
      'לאסוף מוצרים לפי רשימה',
      'לשלם',
      'לחזור הביתה ולסדר',
    ],
    assumptions: ['יש תקציב וחנות פתוחה'],
  },
  {
    type: 'cleaning',
    keywords: ['לנקות', 'ניקיון', 'לשאוב', 'לגרב', 'לנגב', 'לסדר'],
    goal: 'לנקות את המקום הנדרש',
    expectedOutcome: 'מקום נקי ומסודר',
    resourcesNeeded: ['חומרי ניקוי', 'שואב אבק', 'מגב'],
    steps: ['לאסוף ולסדר פריטים', 'לשאוב אבק', 'לנגב משטחים', 'לנקות שירותים', 'לפנות אשפה'],
    assumptions: ['יש חומרי ניקוי'],
  },
  {
    type: 'dog_walk',
    keywords: ['קיטו', 'כלב', 'טיול', 'להוציא', 'לטייל', 'גור'],
    goal: 'להוציא את הכלב לטיול',
    expectedOutcome: 'כלב יצא, עשה צרכים, חזר בריא',
    resourcesNeeded: ['רצועה', 'שקיות', 'מים לכלב'],
    steps: ['להרכיב רצועה', 'לקחת שקיות ומים', 'לצאת לטיול', 'לתת לכלב לעשות צרכים', 'לחזור'],
    assumptions: ['יש זמן של לפחות 15 דקות'],
  },
  {
    type: 'meeting',
    keywords: ['פגישה', 'ישיבה', 'meeting', 'להיפגש', 'לפגוש'],
    goal: 'לנהל פגישה ממוקדת',
    expectedOutcome: 'הפגישה הסתיימה עם תוצרים ברורים',
    resourcesNeeded: ['מקום', 'אג\'נדה', 'מחברת'],
    steps: [
      'להכין אג\'נדה',
      'לוודא שהמשתתפים מוזמנים',
      'להגיע בזמן',
      'לנהל פגישה ממוקדת',
      'לסכם החלטות ומשימות',
    ],
    assumptions: ['כולם יודעים על הפגישה'],
  },
  {
    type: 'document',
    keywords: ['מסמך', 'טופס', 'לכתוב', 'לסיים', 'דוח', 'עבודה', 'להכין'],
    goal: 'להשלים את המסמך או הדוח',
    expectedOutcome: 'מסמך מוכן לשליחה',
    resourcesNeeded: ['מחשב', 'חומרי רקע'],
    steps: [
      'לפתוח את הקובץ',
      'לעבור על מה שכבר נכתב',
      'לזהות מה חסר',
      'לכתוב את החלק הבא',
      'לעבור קריאה סופית',
      'לשמור ולשלוח',
    ],
    assumptions: ['החומרים הנדרשים זמינים'],
  },
];

function detectTaskType(title: string, description?: string): { pattern: TaskPattern | null; confidence: 'high' | 'medium' | 'low' } {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const pattern of TASK_PATTERNS) {
    const matchCount = pattern.keywords.filter((kw) => text.includes(kw)).length;
    if (matchCount >= 2) return { pattern, confidence: 'high' };
    if (matchCount === 1) return { pattern, confidence: 'medium' };
  }
  return { pattern: null, confidence: 'low' };
}

export function buildTaskOperationalBlueprint(input: BlueprintInput): OperationalBlueprint {
  const { task } = input;
  const { pattern, confidence } = detectTaskType(task.title, task.description);

  if (pattern && confidence !== 'low') {
    return {
      taskType: pattern.type,
      goal: pattern.goal,
      expectedOutcome: pattern.expectedOutcome,
      resourcesNeeded: pattern.resourcesNeeded,
      firstStep: pattern.steps[0],
      steps: pattern.steps,
      assumptions: pattern.assumptions,
      confidence,
      clarifyingQuestions: confidence === 'medium' ? ['מה התוצאה שאתה רוצה שתהיה בסוף המשימה?'] : undefined,
    };
  }

  return {
    taskType: 'generic_task',
    goal: `לסיים את: ${task.title}`,
    expectedOutcome: 'המשימה הושלמה',
    resourcesNeeded: [],
    firstStep: 'להגדיר מה התוצאה הרצויה',
    steps: [
      'להגדיר מה התוצאה הרצויה',
      'לזהות מה צריך כדי להתחיל',
      'להתחיל בצעד אחד קטן',
      'להמשיך עד לסיום',
    ],
    assumptions: [],
    confidence: 'low',
    clarifyingQuestions: ['מה התוצאה שאתה רוצה שתהיה בסוף המשימה?'],
  };
}

export function buildSuggestedBreakdown(blueprint: OperationalBlueprint): SuggestedBreakdown {
  return {
    firstStep: blueprint.firstStep,
    steps: blueprint.steps,
    resourcesNeeded: blueprint.resourcesNeeded,
    assumptions: blueprint.assumptions,
  };
}
