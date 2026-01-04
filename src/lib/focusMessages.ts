export interface FocusZone {
  id: number;
  minPercent: number;
  maxPercent: number;
  messages: string[];
}

export const focusZones: FocusZone[] = [
  {
    id: 1,
    minPercent: 0,
    maxPercent: 10,
    messages: [
      'תזהה את הפעולה הראשונה ובצע אותה.',
      'תתחיל לפי הסדר הנכון.',
      'תפעיל את המהלך הראשון.',
      'תבחר נקודת התחלה ברורה ותתחיל.',
      'תתחיל בצורה שמקדמת את הסיום.',
    ],
  },
  {
    id: 2,
    minPercent: 10,
    maxPercent: 20,
    messages: [
      'תמשיך לפי הרצף שבחרת.',
      'תתקדם שלב אחרי שלב.',
      'תשמור על כיוון הפעולה.',
      'תן למהלך לעבוד.',
      'אל תשנה מסלול, תתקדם.',
    ],
  },
  {
    id: 3,
    minPercent: 20,
    maxPercent: 60,
    messages: [
      'תן גז ושמור על חדות.',
      'תתקדם בקצב שמוביל לסיום.',
      'אתה בשליטה, תמשיך.',
      'תיצור יתרון ותנצל אותו.',
      'תישאר בפעולה עד שתראה תוצאה.',
    ],
  },
  {
    id: 4,
    minPercent: 60,
    maxPercent: 90,
    messages: [
      'תתרכז במה שנשאר.',
      'תסגור חכם, לא רחב.',
      'תשלים את הקיים.',
      'תתקדם לסיום בלי להתרחב.',
      'תהיה חכם, לא צודק.',
    ],
  },
  {
    id: 5,
    minPercent: 90,
    maxPercent: 100,
    messages: [
      'תסיים בצורה שמרגישה שלמה.',
      'סגור את זה.',
      'תסיים ותניח.',
      'תשחרר את המשימה כשהיא סגורה.',
      'סיום נקי.',
    ],
  },
];

export function getZoneForPercentage(percentage: number): FocusZone {
  const clampedPercent = Math.max(0, Math.min(100, percentage));
  
  for (const zone of focusZones) {
    if (clampedPercent >= zone.minPercent && clampedPercent < zone.maxPercent) {
      return zone;
    }
  }
  
  return focusZones[focusZones.length - 1];
}

export function getRandomMessage(zone: FocusZone): string {
  const randomIndex = Math.floor(Math.random() * zone.messages.length);
  return zone.messages[randomIndex];
}
