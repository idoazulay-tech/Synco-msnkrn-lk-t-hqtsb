import type { IntentAnalysis } from '../intent/types/intentTypes.js';
import type { ContextManager } from '../intent/memory/ContextManager.js';
import type { DecisionOutput } from './types/decisionTypes.js';
import { createDecisionOutput } from './types/decisionTypes.js';
import { 
  shouldExecute, 
  shouldAsk, 
  shouldStop,
  adjustConfidenceForFollowUp 
} from './policies/thresholds.js';
import { 
  hasAllRequiredFields, 
  isEmotionalDump, 
  isHighCognitiveLoad,
  isVagueInquiry,
  getMostCriticalMissing
} from './policies/rules.js';
import { decideExecute, buildActionPlan } from './strategies/decideExecute.js';
import { decideAsk } from './strategies/decideAsk.js';
import { decideReflect } from './strategies/decideReflect.js';
import { decideStop, shouldTriggerStop } from './strategies/decideStop.js';

export type MergedEntities = Record<string, { raw?: string; normalized?: unknown } | unknown>;

function mergeEntities(
  previous: Record<string, unknown> | null, 
  current: Record<string, unknown>
): Record<string, unknown> {
  if (!previous) return current;
  
  const merged: Record<string, unknown> = { ...previous };
  
  for (const [key, value] of Object.entries(current)) {
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && 'raw' in (value as Record<string, unknown>)) {
        const v = value as { raw?: string; normalized?: unknown };
        if (v.raw) {
          merged[key] = value;
        }
      } else if (Array.isArray(value) && value.length > 0) {
        merged[key] = value;
      } else if (value) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

export class DecisionEngine {
  private contextManager: ContextManager | null = null;

  setContextManager(cm: ContextManager): void {
    this.contextManager = cm;
  }

  decide(analysis: IntentAnalysis): DecisionOutput {
    const isFollowUp = analysis.context?.isFollowUp ?? false;
    let workingAnalysis = { ...analysis };
    
    if (isFollowUp && this.contextManager) {
      const state = this.contextManager.getState();
      if (state.lastEntities) {
        const merged = mergeEntities(
          state.lastEntities as Record<string, unknown>, 
          analysis.entities as unknown as Record<string, unknown>
        );
        workingAnalysis.entities = merged as unknown as typeof analysis.entities;
        
        const newMissing = analysis.missingInfo.filter(field => {
          const entity = merged[field];
          if (!entity) return true;
          if (typeof entity === 'object' && entity !== null && 'raw' in entity) {
            return !(entity as { raw?: string }).raw;
          }
          return false;
        });
        workingAnalysis.missingInfo = newMissing;
      }
    }
    
    const adjustedConfidence = adjustConfidenceForFollowUp(
      workingAnalysis.confidenceScore, 
      isFollowUp
    );
    workingAnalysis.confidenceScore = adjustedConfidence;
    
    if (isEmotionalDump(workingAnalysis)) {
      return decideReflect(workingAnalysis);
    }
    
    if (shouldTriggerStop(workingAnalysis)) {
      return decideStop(workingAnalysis);
    }
    
    const { primaryIntent } = workingAnalysis;
    
    if (primaryIntent === 'inquire') {
      if (isVagueInquiry(workingAnalysis)) {
        return decideReflect(workingAnalysis);
      }
      return decideExecute(workingAnalysis);
    }
    
    if (primaryIntent === 'journal_entry') {
      return decideExecute(workingAnalysis);
    }
    
    if (primaryIntent === 'cancel') {
      if (!workingAnalysis.entities.taskName?.raw && 
          workingAnalysis.missingInfo.includes('target')) {
        return decideAsk(workingAnalysis);
      }
      return decideExecute(workingAnalysis);
    }
    
    if (primaryIntent === 'reschedule' || primaryIntent === 'manage_day') {
      if (workingAnalysis.missingInfo.includes('scope') && 
          !workingAnalysis.entities.date?.raw) {
        return decideAsk(workingAnalysis);
      }
      return decideExecute(workingAnalysis);
    }
    
    const hasRequired = hasAllRequiredFields(primaryIntent, workingAnalysis);
    
    if (hasRequired && shouldExecute(adjustedConfidence, workingAnalysis.cognitiveLoad)) {
      return decideExecute(workingAnalysis);
    }
    
    if (!hasRequired || shouldAsk(adjustedConfidence)) {
      if (isHighCognitiveLoad(workingAnalysis)) {
        if (workingAnalysis.missingInfo.length > 0) {
          return decideAsk(workingAnalysis);
        }
        return decideReflect(workingAnalysis);
      }
      return decideAsk(workingAnalysis);
    }
    
    if (shouldStop(adjustedConfidence)) {
      return decideStop(workingAnalysis);
    }
    
    if (workingAnalysis.inputType === 'thought') {
      return decideReflect(workingAnalysis);
    }
    
    return decideAsk(workingAnalysis);
  }
}

export type { DecisionOutput };
