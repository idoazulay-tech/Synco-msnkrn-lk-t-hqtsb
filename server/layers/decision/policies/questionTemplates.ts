import { ExpectedAnswerType } from '../types/decisionTypes.js';

export interface QuestionTemplate {
  id: string;
  text: string;
  expectedAnswerType: ExpectedAnswerType;
  options: string[];
}

export const QUESTION_TEMPLATES: Record<string, QuestionTemplate> = {
  date: {
    id: 'date',
    text: 'לאיזה תאריך זה?',
    expectedAnswerType: 'date',
    options: ['היום', 'מחר', 'מחרתיים']
  },
  time: {
    id: 'time',
    text: 'באיזו שעה?',
    expectedAnswerType: 'time',
    options: []
  },
  duration: {
    id: 'duration',
    text: 'כמה זמן זה ייקח?',
    expectedAnswerType: 'duration',
    options: ['5 דקות', '15 דקות', '30 דקות', 'שעה']
  },
  scope: {
    id: 'scope',
    text: 'על מה לסדר מחדש?',
    expectedAnswerType: 'choice',
    options: ['היום', 'מחר', 'כל השבוע']
  },
  targetCancel: {
    id: 'targetCancel',
    text: 'מה לבטל?',
    expectedAnswerType: 'choice',
    options: ['משימה', 'פגישה', 'תזכורת']
  },
  clarifyIntent: {
    id: 'clarifyIntent',
    text: 'רוצה שאוסיף משימה, פגישה, או רק לרשום הערה?',
    expectedAnswerType: 'choice',
    options: ['משימה', 'פגישה', 'הערה']
  },
  taskName: {
    id: 'taskName',
    text: 'מה שם המשימה?',
    expectedAnswerType: 'free_text',
    options: []
  },
  people: {
    id: 'people',
    text: 'עם מי?',
    expectedAnswerType: 'free_text',
    options: []
  },
  confirm: {
    id: 'confirm',
    text: 'נכון?',
    expectedAnswerType: 'confirm',
    options: ['כן', 'לא']
  },
  inquiryType: {
    id: 'inquiryType',
    text: 'רוצה לראות לוז היום או רשימת משימות?',
    expectedAnswerType: 'choice',
    options: ['לוז היום', 'רשימת משימות', 'שניהם']
  }
};

export function getQuestionTemplate(id: string): QuestionTemplate | null {
  return QUESTION_TEMPLATES[id] ?? null;
}
