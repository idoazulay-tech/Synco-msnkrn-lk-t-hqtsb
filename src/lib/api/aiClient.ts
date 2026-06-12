// ─── Synco AI Client ──────────────────────────────────────────────────────────
// Sprint 4ד.1 — AI-First Controlled Rollout
// All functions are preview-only. No DB writes. No state changes.
// AI is called only on explicit user action — never on render.

export interface AIStatusResponse {
  ok: boolean;
  enabled: boolean;
  provider: string;
  hasOpenAIKey: boolean;
  parseEnabled: boolean;
  taskReportEnabled: boolean;
  breakdownEnabled: boolean;
  dayCommandEnabled: boolean;
  externalKnowledgeEnabled: boolean;
  note?: string;
}

export interface ParsedTask {
  title: string;
  date?: string | null;
  hour?: number | null;
  minute?: number | null;
  duration?: number;
  priority?: 'high' | 'medium' | 'low';
  flexibility?: 'fixed' | 'flexible' | 'anytime';
  location?: string | null;
  notes?: string | null;
}

export interface AIParseContext {
  scenarioType?: string;
  anchors?: string[];
  questions?: string[];
  assumptions?: string[];
  warnings?: string[];
  confidence?: 'low' | 'medium' | 'high';
}

export interface ParsePreviewResponse {
  ok: boolean;
  parser: 'ai_structured' | 'rule_based' | 'rule_based_fallback';
  tasks: ParsedTask[];
  aiContext?: AIParseContext;
  reason?: string;
  message?: string;
}

export interface TaskReportAIAnalysis {
  scope: 'task_only';
  normalizedCategory: string;
  userIntention: string;
  confidence: 'low' | 'medium' | 'high';
  immediateSuggestion: string;
  suggestedActions: string[];
  followUpQuestions?: string[];
  taskMeaning?: string;
  consequenceIfNotDone?: string;
  assumptions?: string[];
}

export interface TaskReportPreviewResponse {
  ok: boolean;
  source: 'ai' | 'rule_based';
  scope?: 'task_only';
  analysis?: TaskReportAIAnalysis;
  reason?: string;
  message?: string;
}

export interface AIBreakdown {
  taskType: string;
  goal: string;
  expectedOutcome: string;
  resourcesNeeded: string[];
  firstStep: string;
  steps: string[];
  assumptions: string[];
  confidence: 'low' | 'medium' | 'high';
  clarifyingQuestions?: string[];
}

export interface BreakdownPreviewResponse {
  ok: boolean;
  source: 'ai' | 'rule_based';
  breakdown?: AIBreakdown;
  reason?: string;
  message?: string;
}

export interface DayCommandPreviewParams {
  userId?: string;
  dateIso: string;
  text: string;
  selectedTaskIds?: string[];
  nowIso?: string;
}

export interface AIGuidanceResponse {
  ok: boolean;
  source: 'ai' | 'fallback';
  explanation: string;
  firstStep: string;
  confidence: 'low' | 'medium' | 'high';
}

// ─── getAIStatus ──────────────────────────────────────────────────────────────

export async function getAIStatus(): Promise<AIStatusResponse> {
  try {
    const res = await fetch('/api/ai/status');
    return res.json();
  } catch {
    return {
      ok: false,
      enabled: false,
      provider: 'unknown',
      hasOpenAIKey: false,
      parseEnabled: false,
      taskReportEnabled: false,
      breakdownEnabled: false,
      dayCommandEnabled: false,
      externalKnowledgeEnabled: false,
    };
  }
}

// ─── parsePreviewAI ───────────────────────────────────────────────────────────
// Calls /api/planner/parse with useAI:true
// Returns tasks + aiContext. Never writes to DB.

export async function parsePreviewAI(params: {
  text: string;
  dateIso?: string;
  existingTasks?: { title: string; hour: number; minute: number; duration: number }[];
}): Promise<ParsePreviewResponse> {
  try {
    const res = await fetch('/api/planner/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.text,
        dateIso: params.dateIso ?? new Date().toISOString().split('T')[0],
        todayDate: params.dateIso ?? new Date().toISOString().split('T')[0],
        existingTasks: params.existingTasks ?? [],
        useAI: true,
      }),
    });
    const data = await res.json();
    return {
      ok: true,
      parser: data.parser ?? 'rule_based',
      tasks: data.tasks ?? [],
      aiContext: data.aiContext,
    };
  } catch (err: any) {
    return {
      ok: false,
      parser: 'rule_based',
      tasks: [],
      reason: 'network_error',
      message: err?.message,
    };
  }
}

// ─── taskReportPreviewAI ──────────────────────────────────────────────────────
// Calls /api/ai/analyze-task-report
// Returns AI analysis of a task report. Preview only, scope=task_only.
// Phase 2b: optionally includes userId for deferred question persistence.

export async function taskReportPreviewAI(params: {
  taskTitle: string;
  taskDescription?: string;
  selectedOption: string;
  selectedLabel: string;
  freeText?: string;
  userId?: string;
}): Promise<TaskReportPreviewResponse> {
  try {
    const res = await fetch('/api/ai/analyze-task-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        userId: params.userId ?? 'default-user',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, source: 'rule_based', reason: data.reason, message: data.message };
    }
    return { ok: true, source: 'ai', scope: 'task_only', analysis: data.analysis };
  } catch (err: any) {
    return { ok: false, source: 'rule_based', reason: 'network_error', message: err?.message };
  }
}

// ─── breakdownPreviewAI ───────────────────────────────────────────────────────
// Calls /api/ai/breakdown
// Returns AI task breakdown. Preview only — user must explicitly trigger.
// Phase 2b: optionally includes userId for deferred question persistence.

export async function breakdownPreviewAI(params: {
  taskTitle: string;
  taskDescription?: string;
  selectedOption?: string;
  freeText?: string;
  userId?: string;
}): Promise<BreakdownPreviewResponse> {
  try {
    const res = await fetch('/api/ai/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        userId: params.userId ?? 'default-user',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, source: 'rule_based', reason: data.reason, message: data.message };
    }
    return { ok: true, source: 'ai', breakdown: data.breakdown };
  } catch (err: any) {
    return { ok: false, source: 'rule_based', reason: 'network_error', message: err?.message };
  }
}

// ─── dayCommandPreviewAI ──────────────────────────────────────────────────────
// Calls /api/planner/day-command-preview with useAI:true (already the default)

export async function dayCommandPreviewAI(params: DayCommandPreviewParams) {
  const res = await fetch('/api/planner/day-command-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: params.userId ?? 'default-user',
      dateIso: params.dateIso,
      text: params.text,
      selectedTaskIds: params.selectedTaskIds ?? [],
      nowIso: params.nowIso ?? new Date().toISOString(),
      useAI: true,
    }),
  });
  return res.json().catch(() => ({
    ok: false,
    questions: [],
    assumptions: [],
    warnings: [],
    reason: 'network_error',
  }));
}

// ─── getTaskGuidanceAI ────────────────────────────────────────────────────────
// "למה עכשיו?" — calls /api/ai/guidance
// Preview only — no state changes, no DB writes.

export async function getTaskGuidanceAI(params: {
  taskTitle: string;
  taskDescription?: string;
  startTime?: string;
}): Promise<AIGuidanceResponse> {
  try {
    const res = await fetch('/api/ai/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        nowIso: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    return {
      ok: data.ok ?? false,
      source: data.source ?? 'fallback',
      explanation: data.explanation ?? '',
      firstStep: data.firstStep ?? '',
      confidence: data.confidence ?? 'low',
    };
  } catch {
    return { ok: false, source: 'fallback', explanation: '', firstStep: '', confidence: 'low' };
  }
}
