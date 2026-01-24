// Layer 7: Hebrew Templates for Feedback Messages

import type { ToneType } from '../types/feedbackTypes.js';

export interface TemplateSet {
  neutral: string;
  gentle: string;
  direct: string;
}

export const REFLECTION_TEMPLATES = {
  missingInfo: {
    neutral: 'הבנתי שאתה רוצה ליצור {type}: {title}. חסר לי רק: {missing}.',
    gentle: 'נראה שאתה רוצה {type}. בוא נשלים פרט קטן: {missing}.',
    direct: 'צריך עוד פרט אחד: {missing}.'
  } as TemplateSet,
  
  lowConfidence: {
    neutral: 'הבנתי כך: {understanding}. מתקדם.',
    gentle: 'נראה לי שזה מה שרצית: {understanding}. נכון?',
    direct: 'מבצע: {understanding}.'
  } as TemplateSet,
  
  reflect: {
    neutral: 'נראה שיש עומס. נבחר צעד אחד קטן.',
    gentle: 'הרבה דברים על הראש? בוא נתמקד בדבר אחד קטן.',
    direct: 'יש הרבה. נתחיל מצעד אחד.'
  } as TemplateSet,
  
  stop: {
    neutral: 'לא הצלחתי להבין. אפשר לנסח אחרת?',
    gentle: 'קצת התבלבלתי. תוכל להסביר שוב בקצרה?',
    direct: 'לא הבנתי. נסה שוב.'
  } as TemplateSet
};

export const POST_ACTION_TEMPLATES = {
  markDone: {
    neutral: 'סימנת בוצע: {title}. נשארו עוד {remaining}.',
    gentle: 'יפה! סיימת: {title}. עוד {remaining} לסיום.',
    direct: 'בוצע: {title}. נשאר: {remaining}.'
  } as TemplateSet,
  
  markDoneLast: {
    neutral: 'סיימת את כל המשימות להיום!',
    gentle: 'מדהים! סיימת הכל! מגיע לך הפסקה.',
    direct: 'הכל בוצע.'
  } as TemplateSet,
  
  cancel: {
    neutral: 'ביטלנו: {title}. רוצה להעביר ליום אחר?',
    gentle: 'ביטלנו את {title}. זה בסדר, לפעמים צריך לוותר. רוצה לתזמן מחדש?',
    direct: 'בוטל: {title}. מתזמן מחדש?'
  } as TemplateSet,
  
  reschedule: {
    neutral: 'סידרתי מחדש: {title}.',
    gentle: 'העברתי את {title}. הזמן החדש מתאים יותר.',
    direct: 'הועבר: {title}.'
  } as TemplateSet,
  
  create: {
    neutral: 'נוצר: {title}.',
    gentle: 'הוספתי: {title}. בהצלחה!',
    direct: 'נוסף: {title}.'
  } as TemplateSet
};

export const AUTOMATION_TEMPLATES = {
  success: {
    neutral: 'עודכן ביומן: {title}.',
    gentle: 'שמרתי ביומן: {title}. הכל מסונכרן!',
    direct: 'סונכרן: {title}.'
  } as TemplateSet,
  
  failed: {
    neutral: 'לא הצלחתי לעדכן ביומן. נסה שוב מאוחר יותר.',
    gentle: 'הייתה בעיה בסנכרון. אל דאגה, ננסה שוב.',
    direct: 'שגיאת סנכרון. נסה שוב.'
  } as TemplateSet,
  
  needsUserAction: {
    neutral: 'צריך חיבור מחדש ליומן ב Integrations.',
    gentle: 'כדי לסנכרן, צריך להתחבר מחדש ליומן. לחץ על Integrations.',
    direct: 'נדרש חיבור מחדש.'
  } as TemplateSet
};

export const DAILY_REVIEW_TEMPLATES = {
  header: {
    neutral: 'סיכום יום',
    gentle: 'איך היה היום?',
    direct: 'סיכום'
  } as TemplateSet,
  
  completion: {
    neutral: 'היום בוצעו: {completed} מתוך {total}.',
    gentle: 'עשית היום {completed} מתוך {total}. יפה!',
    direct: 'בוצע: {completed}/{total}.'
  } as TemplateSet,
  
  topBlocker: {
    neutral: 'הדבר הכי תקוע: {blocker}.',
    gentle: 'משהו שאולי צריך תשומת לב: {blocker}.',
    direct: 'חסימה: {blocker}.'
  } as TemplateSet,
  
  topMust: {
    neutral: 'המשימה הכי חשובה למחר: {must}.',
    gentle: 'למחר כדאי להתמקד ב: {must}.',
    direct: 'מחר: {must}.'
  } as TemplateSet,
  
  microStep: {
    neutral: 'הצעד הבא הכי קטן: {step}.',
    gentle: 'נתחיל מצעד קטן: {step}.',
    direct: 'הבא: {step}.'
  } as TemplateSet
};

export const CHECKIN_TEMPLATES = {
  durationMismatch: {
    neutral: 'הערכת הזמן הייתה {direction}. לעדכן את הזמן ברירת מחדל?',
    gentle: 'נראה ש{direction} בהערכת הזמן. רוצה שאזכור לפעם הבאה?',
    direct: 'זמן {direction}. לעדכן?'
  } as TemplateSet,
  
  wrongIntent: {
    neutral: 'הבנתי נכון? {understanding}',
    gentle: 'רק לוודא שהבנתי: {understanding}',
    direct: 'זה מה שרצית? {understanding}'
  } as TemplateSet,
  
  stressSignal: {
    neutral: 'נראה שיש הרבה על הראש. רוצה להוריד עומס?',
    gentle: 'יום עמוס, נכון? בוא נמצא דרך להקל.',
    direct: 'עומס גבוה. להפחית משימות?'
  } as TemplateSet,
  
  automationFailed: {
    neutral: 'הסנכרון נכשל. לנסות שוב?',
    gentle: 'הייתה בעיה בסנכרון. רוצה לנסות שוב?',
    direct: 'נכשל. לנסות שוב?'
  } as TemplateSet
};

export function applyTemplate(template: TemplateSet, tone: ToneType, vars: Record<string, string | number>): string {
  let text = template[tone];
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return text;
}
