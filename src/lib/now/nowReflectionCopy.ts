export type ResultType = 'done' | 'stuck' | 'not_now';

export interface ReflectionCopy {
  title: string;
  message: string;
  primaryButton: string;
  secondaryButton: string;
}

export function getReflectionCopy(resultType: ResultType): ReflectionCopy {
  switch (resultType) {
    case 'done':
      return {
        title: 'מעולה, סיימת פעולה אחת',
        message:
          'סימנתי את זה כהושלם. עכשיו אפשר לבחור את הפעולה הבאה בלי לפתוח את כל הרשימה.',
        primaryButton: 'הצג פעולה הבאה',
        secondaryButton: 'סיים כרגע',
      };
    case 'stuck':
      return {
        title: 'סבבה, סימנתי שנתקעת',
        message:
          'לא נלחמים בזה עכשיו. סינקו ישמור את זה כלמידה ולא יחזיר אותך לאותה פעולה בסשן הזה.',
        primaryButton: 'הצג פעולה אחרת',
        secondaryButton: 'סיים כרגע',
      };
    case 'not_now':
      return {
        title: 'הבנתי, לא עכשיו',
        message:
          'נשאיר את זה בצד כרגע ונבחר משהו אחר שאולי יותר מתאים להתחיל ממנו.',
        primaryButton: 'הצג פעולה אחרת',
        secondaryButton: 'סיים כרגע',
      };
  }
}
