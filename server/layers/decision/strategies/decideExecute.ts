import type { IntentAnalysis } from '../../intent/types/intentTypes.js';
import type { DecisionOutput, ActionPlan } from '../types/decisionTypes.js';
import { createDecisionOutput, createEmptyActionPlan } from '../types/decisionTypes.js';

export function buildActionPlan(analysis: IntentAnalysis): ActionPlan {
  const plan = createEmptyActionPlan();
  const { entities, primaryIntent } = analysis;
  const constraints = entities.constraints ?? [];
  
  switch (primaryIntent) {
    case 'create_task':
      plan.actionType = 'create_task';
      plan.payload = {
        taskName: entities.taskName?.normalized ?? entities.taskName?.raw ?? '',
        durationMinutes: entities.duration?.normalized ?? null,
        dateIso: entities.date?.normalized ?? null,
        timeIso: entities.time?.normalized ?? null,
        mustLock: entities.must?.normalized === true,
        urgency: entities.urgency?.normalized ?? 'low'
      };
      plan.mustLock = entities.must?.normalized === true;
      plan.urgency = entities.urgency?.normalized ?? 'low';
      break;
      
    case 'create_event':
      plan.actionType = 'create_event';
      plan.payload = {
        taskName: entities.taskName?.normalized ?? '',
        dateIso: entities.date?.normalized ?? null,
        timeIso: entities.time?.normalized ?? null,
        durationMinutes: entities.duration?.normalized ?? 60,
        people: entities.people ?? [],
        location: entities.location?.normalized ?? null
      };
      plan.urgency = 'medium';
      break;
      
    case 'reschedule':
      plan.actionType = 'reschedule';
      plan.payload = {
        scope: entities.date?.raw ?? 'today',
        targetDate: entities.date?.normalized ?? null
      };
      break;
      
    case 'cancel':
      plan.actionType = 'cancel';
      plan.payload = {
        target: entities.taskName?.normalized ?? entities.taskName?.raw ?? ''
      };
      break;
      
    case 'inquire':
      plan.actionType = 'inquire';
      plan.payload = {
        scope: entities.date?.raw ?? 'today',
        queryType: 'schedule'
      };
      break;
      
    case 'journal_entry':
      plan.actionType = 'log_note';
      plan.payload = {
        text: analysis.rawText ?? ''
      };
      break;
      
    case 'manage_day':
      plan.actionType = 'reschedule';
      plan.payload = {
        scope: 'today',
        action: 'reorganize'
      };
      break;
      
    default:
      plan.actionType = 'none';
  }
  
  if (constraints && constraints.length > 0) {
    plan.constraints = constraints.map((c: { type: string; details?: Record<string, unknown> }) => 
      `${c.type}: ${JSON.stringify(c.details ?? {})}`
    );
  }
  
  return plan;
}

export function decideExecute(analysis: IntentAnalysis): DecisionOutput {
  const actionPlan = buildActionPlan(analysis);
  
  let nextLayer: 'task' | 'learning' | 'feedback' | 'none' = 'task';
  if (analysis.primaryIntent === 'journal_entry') {
    nextLayer = 'learning';
  } else if (analysis.primaryIntent === 'inquire') {
    nextLayer = 'none';
  }
  
  return createDecisionOutput({
    decision: 'execute',
    reason: `ביצוע ${analysis.primaryIntent} עם ביטחון ${(analysis.confidenceScore * 100).toFixed(0)}%`,
    confidence: analysis.confidenceScore,
    requiredNextLayer: nextLayer,
    actionPlan
  });
}
