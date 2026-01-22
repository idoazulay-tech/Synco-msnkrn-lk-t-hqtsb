import type { IntentAnalysis } from '../../intent/types/intentTypes.js';
import type { DecisionOutput, Reflection } from '../types/decisionTypes.js';
import { createDecisionOutput } from '../types/decisionTypes.js';

const EMOTIONAL_REFLECTIONS = [
  'נשמע שיש לך הרבה על הראש עכשיו.',
  'אני שומע שזה לא פשוט.',
  'נראה שיש עומס. בוא ננסה לפשט.',
  'הבנתי. קודם כל, בוא נעשה סדר קטן.'
];

const MICRO_STEPS = [
  'רוצה שנבחר דבר אחד קטן ל-5 דקות?',
  'בוא נתחיל מדבר אחד קל - מה הכי קטן ופשוט?',
  'מה הדבר הראשון שאתה רוצה להוריד מהראש?',
  'בוא נתמקד ברגע הזה בלבד - מה הכי דחוף?'
];

const THOUGHT_REFLECTIONS = [
  'הבנתי שאתה חושב על זה.',
  'זה נשמע כמו משהו שאפשר להפוך למשימה.',
  'רוצה שאעזור להפוך את זה לצעד מעשי?'
];

const VAGUE_INQUIRY_REFLECTIONS = [
  'רוצה לראות לוז היום או רשימת משימות?',
  'על מה להתמקד - היום, מחר, או כל השבוע?'
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildReflection(analysis: IntentAnalysis): Reflection {
  const { inputType, cognitiveLoad } = analysis;
  
  if (inputType === 'emotional_dump') {
    return {
      shouldReflect: true,
      text: pickRandom(EMOTIONAL_REFLECTIONS),
      microStep: pickRandom(MICRO_STEPS)
    };
  }
  
  if (cognitiveLoad === 'high') {
    return {
      shouldReflect: true,
      text: 'נראה שיש הרבה. בוא נפשט.',
      microStep: pickRandom(MICRO_STEPS)
    };
  }
  
  if (inputType === 'thought') {
    return {
      shouldReflect: true,
      text: pickRandom(THOUGHT_REFLECTIONS),
      microStep: 'רוצה להוסיף את זה כמשימה או כתזכורת?'
    };
  }
  
  return {
    shouldReflect: true,
    text: pickRandom(VAGUE_INQUIRY_REFLECTIONS),
    microStep: ''
  };
}

export function decideReflect(analysis: IntentAnalysis): DecisionOutput {
  const reflection = buildReflection(analysis);
  
  return createDecisionOutput({
    decision: 'reflect',
    reason: analysis.inputType === 'emotional_dump' 
      ? 'זוהה עומס רגשי' 
      : 'נדרשת הבהרה לפני המשך',
    confidence: analysis.confidenceScore,
    requiredNextLayer: 'none',
    reflection
  });
}
