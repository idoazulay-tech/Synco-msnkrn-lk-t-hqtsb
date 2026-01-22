import type { IntentAnalysis } from '../../intent/types/intentTypes.js';

export type MissingField = 'date' | 'time' | 'taskName' | 'scope' | 'target' | 'duration' | 'people' | 'clarifyIntent';

export interface IntentRule {
  intent: string;
  requiredFields: string[];
  optionalFields: string[];
  criticalFieldPriority: MissingField[];
}

export const INTENT_RULES: Record<string, IntentRule> = {
  create_event: {
    intent: 'create_event',
    requiredFields: ['date', 'time'],
    optionalFields: ['taskName', 'people', 'location', 'duration'],
    criticalFieldPriority: ['date', 'time', 'taskName', 'people']
  },
  create_task: {
    intent: 'create_task',
    requiredFields: ['taskName'],
    optionalFields: ['date', 'time', 'duration', 'urgency'],
    criticalFieldPriority: ['taskName', 'duration']
  },
  reschedule: {
    intent: 'reschedule',
    requiredFields: ['scope'],
    optionalFields: ['date', 'time'],
    criticalFieldPriority: ['scope', 'date']
  },
  cancel: {
    intent: 'cancel',
    requiredFields: ['target'],
    optionalFields: [],
    criticalFieldPriority: ['target']
  },
  inquire: {
    intent: 'inquire',
    requiredFields: [],
    optionalFields: ['scope', 'date'],
    criticalFieldPriority: []
  },
  journal_entry: {
    intent: 'journal_entry',
    requiredFields: [],
    optionalFields: [],
    criticalFieldPriority: []
  },
  manage_day: {
    intent: 'manage_day',
    requiredFields: [],
    optionalFields: ['scope'],
    criticalFieldPriority: ['scope']
  }
};

export function getIntentRule(intent: string): IntentRule | null {
  return INTENT_RULES[intent] ?? null;
}

export function getMostCriticalMissing(intent: string, missingInfo: string[]): MissingField | null {
  const rule = getIntentRule(intent);
  if (!rule) return null;
  
  for (const field of rule.criticalFieldPriority) {
    if (missingInfo.includes(field)) {
      return field;
    }
  }
  return null;
}

export function hasAllRequiredFields(intent: string, analysis: IntentAnalysis): boolean {
  const rule = getIntentRule(intent);
  if (!rule) return true;
  
  const entities = analysis.entities;
  for (const field of rule.requiredFields) {
    if (field === 'scope') {
      if (!entities.date?.raw && analysis.missingInfo.includes('scope')) {
        return false;
      }
      continue;
    }
    if (field === 'target') {
      if (!entities.taskName?.raw && analysis.missingInfo.includes('target')) {
        return false;
      }
      continue;
    }
    const entity = entities[field as keyof typeof entities];
    if (!entity || (typeof entity === 'object' && 'raw' in entity && !entity.raw)) {
      return false;
    }
  }
  return true;
}

export function isEmotionalDump(analysis: IntentAnalysis): boolean {
  return analysis.inputType === 'emotional_dump';
}

export function isHighCognitiveLoad(analysis: IntentAnalysis): boolean {
  return analysis.cognitiveLoad === 'high';
}

export function isVagueInquiry(analysis: IntentAnalysis): boolean {
  const vaguePatterns = ['מה קורה', 'מה יש', 'מה הולך', 'איך הכל'];
  const text = analysis.rawText?.toLowerCase() ?? '';
  return vaguePatterns.some(p => text.includes(p)) && 
         !analysis.entities.date?.raw && 
         !analysis.entities.time?.raw;
}
