// Layer 4: Task & Time Engine - MustLock Rules

import type { Task } from '../types/taskTypes.js';

const MUST_LOCK_KEYWORDS = [
  'חייב',
  'קריטי',
  'דחוף',
  'חשוב מאוד',
  'בשום אופן',
  'מוכרח',
  'הכרחי',
  'אסור לדחות',
  'deadline'
];

const HIGH_URGENCY_KEYWORDS = [
  'היום',
  'עכשיו',
  'מיד',
  'בדחיפות',
  'ממש צריך'
];

export function shouldBeMustLock(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MUST_LOCK_KEYWORDS.some(kw => lowerText.includes(kw));
}

export function detectUrgency(text: string): 'low' | 'medium' | 'high' {
  const lowerText = text.toLowerCase();
  
  if (MUST_LOCK_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'high';
  }
  
  if (HIGH_URGENCY_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'high';
  }
  
  if (/מחר|השבוע|בקרוב/.test(text)) {
    return 'medium';
  }
  
  return 'low';
}

export function validateMustLockPlacement(
  task: Task,
  canBePlaced: boolean
): { valid: boolean; message: string } {
  if (!task.mustLock) {
    return { valid: true, message: '' };
  }
  
  if (!canBePlaced) {
    return {
      valid: false,
      message: `משימה קריטית "${task.title}" חייבת להיכנס ללוח הזמנים`
    };
  }
  
  return { valid: true, message: '' };
}
