export type QuestionGoal = 
  | 'resolve_time' 
  | 'resolve_order' 
  | 'resolve_duration' 
  | 'resolve_conflict' 
  | 'resolve_status'
  | 'resolve_date'
  | 'resolve_title';

export interface ActiveQuestionContext {
  id: string;
  entityId: string;
  questionGoal: QuestionGoal;
  missingInfo: string[];
  askedAt: Date;
  questionText: string;
  previousContextId?: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface NewEvidence {
  type: 'time' | 'date' | 'duration' | 'order' | 'status' | 'preference' | 'title' | 'conflict_resolution';
  value: string;
  confidence: number;
  source: 'user_answer' | 'inference' | 'default';
  extractedAt: Date;
}

export interface ContextResolutionResult {
  goalAchieved: boolean;
  extractedEvidence: NewEvidence[];
  nextAction: 'execute' | 'ask_followup' | 'wait';
  followupQuestion?: string;
  followupGoal?: QuestionGoal;
}

const activeContexts: Map<string, ActiveQuestionContext> = new Map();
const contextChains: Map<string, string[]> = new Map();

export function createActiveContext(
  entityId: string,
  questionGoal: QuestionGoal,
  missingInfo: string[],
  questionText: string,
  previousContextId?: string
): ActiveQuestionContext {
  const id = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const context: ActiveQuestionContext = {
    id,
    entityId,
    questionGoal,
    missingInfo,
    askedAt: new Date(),
    questionText,
    previousContextId,
    resolved: false
  };
  
  activeContexts.set(id, context);
  
  if (previousContextId) {
    const chain = contextChains.get(entityId) || [];
    if (!chain.includes(previousContextId)) {
      chain.push(previousContextId);
    }
    chain.push(id);
    contextChains.set(entityId, chain);
  } else {
    contextChains.set(entityId, [id]);
  }
  
  return context;
}

export function getActiveContextForEntity(entityId: string): ActiveQuestionContext | undefined {
  for (const context of activeContexts.values()) {
    if (context.entityId === entityId && !context.resolved) {
      return context;
    }
  }
  return undefined;
}

export function getContextChain(entityId: string): ActiveQuestionContext[] {
  const chain = contextChains.get(entityId) || [];
  return chain
    .map(id => activeContexts.get(id))
    .filter((ctx): ctx is ActiveQuestionContext => ctx !== undefined);
}

export function resolveContext(contextId: string): void {
  const context = activeContexts.get(contextId);
  if (context) {
    context.resolved = true;
    context.resolvedAt = new Date();
    activeContexts.set(contextId, context);
  }
}

export function getLatestUnresolvedContext(): ActiveQuestionContext | undefined {
  let latest: ActiveQuestionContext | undefined;
  
  for (const context of activeContexts.values()) {
    if (!context.resolved) {
      if (!latest || context.askedAt > latest.askedAt) {
        latest = context;
      }
    }
  }
  
  return latest;
}

export function clearResolvedContexts(): void {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  for (const [id, context] of activeContexts.entries()) {
    if (context.resolved && context.resolvedAt && context.resolvedAt < oneHourAgo) {
      activeContexts.delete(id);
    }
  }
}
