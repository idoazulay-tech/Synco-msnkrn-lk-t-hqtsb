/**
 * Synco Hebrew Localization — Default Language
 *
 * All user-facing strings for the Synco brain layer.
 * Hebrew is the primary product language.
 *
 * Style guide:
 * - calm, practical, supportive
 * - no shame, no diagnosis, no dramatic wording
 * - short sentences, clear action
 */

export const heMessages = {
  recommendation: {
    lifeRuleBlock: (ruleTitle: string): string =>
      `זה מתנגש עם חוק שהגדרת: "${ruleTitle}". עדיף להעביר למחר או להקטין את המשימה.`,
    lifeRuleBlockAction: 'העבר למחר, או שנה את שעת הביצוע.',
    lifeRuleBlockReason: 'חוק חיים פעיל חוסם פעולה זו.',

    highRiskPrediction:
      'יש סיכוי שהיום קצת קשה יותר לביצוע. מה אם נתחיל עם משהו קטן וברור?',
    highRiskPredictionAction: 'התחל עם משימה קטנה ומוגדרת.',
    highRiskPredictionReason: 'אות היסטורי מעיד על סיכון אפשרי לביצוע.',

    overloadWarning:
      'היום נראה עמוס יחסית. עדיף לבחור 3 פעולות מרכזיות ולהשאיר את השאר לגמיש.',
    overloadWarningAction: 'בחר 3 משימות מרכזיות להיום.',
    overloadWarningReason: 'עומס יחסי זוהה בהקשר הנוכחי.',

    missingInfo:
      'אני יכול לשמור את זה עכשיו, אבל חסר לי פרט שיעזור לי לדייק בהמשך.',
    missingInfoAction: 'הוסף פרטים כדי שאוכל לעזור טוב יותר.',
    missingInfoReason: 'הקשר חסר למיקוד טוב יותר.',
  },
  openQuestions: {
    whoIsPerson: (name: string): string => `מי זה ${name} עבורך?`,
    whichProject: 'על איזה פרויקט התכוונת?',
  },
} as const;

export type HeMessages = typeof heMessages;
