import { z } from 'zod';

// ─── Parsed Planning Intent ───────────────────────────────────────────────────

export const ParsedTaskSchema = z.object({
  title:       z.string(),
  date:        z.string().nullable().optional(),
  hour:        z.number().int().min(0).max(23).nullable().optional(),
  minute:      z.number().int().min(0).max(59).nullable().optional(),
  duration:    z.number().int().min(1).max(480).optional().default(30),
  priority:    z.enum(['high', 'medium', 'low']).optional().default('medium'),
  flexibility: z.enum(['fixed', 'flexible', 'anytime']).optional().default('flexible'),
  location:    z.string().nullable().optional(),
  notes:       z.string().nullable().optional(),
});

export const ParsedPlanningIntentSchema = z.object({
  ok:           z.boolean().optional().default(true),
  tasks:        z.array(ParsedTaskSchema),
  scenarioType: z.string().optional(),
  anchors:      z.array(z.string()).optional().default([]),
  questions:    z.array(z.string()).optional().default([]),
  assumptions:  z.array(z.string()).optional().default([]),
  warnings:     z.array(z.string()).optional().default([]),
  confidence:   z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

// ─── Task Report AI Analysis ──────────────────────────────────────────────────

export const TaskReportAIAnalysisSchema = z.object({
  scope:                z.literal('task_only'),
  normalizedCategory:   z.string(),
  userIntention:        z.string(),
  confidence:           z.enum(['low', 'medium', 'high']),
  immediateSuggestion:  z.string(),
  suggestedActions:     z.array(z.string()),
  followUpQuestions:    z.array(z.string()).optional().default([]),
  taskMeaning:          z.string().optional(),
  consequenceIfNotDone: z.string().optional(),
  assumptions:          z.array(z.string()).optional().default([]),
});

// ─── Task Breakdown ───────────────────────────────────────────────────────────

export const TaskBreakdownSchema = z.object({
  taskType:            z.string(),
  goal:                z.string(),
  expectedOutcome:     z.string(),
  resourcesNeeded:     z.array(z.string()),
  firstStep:           z.string(),
  steps:               z.array(z.string()),
  assumptions:         z.array(z.string()),
  confidence:          z.enum(['low', 'medium', 'high']),
  clarifyingQuestions: z.array(z.string()).optional().default([]),
});

// ─── Day Command Intent ───────────────────────────────────────────────────────

// RecurrenceSchema: all required fields have safe defaults so partial AI output never crashes Zod.
export const RecurrenceSchema = z.object({
  frequency:     z.enum(['daily', 'weekly', 'custom']).optional().default('weekly'),
  daysOfWeek:    z.array(z.string()).optional().default([]),
  startDate:     z.string().nullable().optional(),
  endDate:       z.string().nullable().optional(),
  sourceTaskIds: z.array(z.string()).optional().default([]),
  appliesTo:     z.enum(['all_day', 'selected_tasks', 'time_range', 'morning', 'custom'])
                   .optional()
                   .default('custom'),
});

// Use .catch(null) on the recurrence field so any malformed recurrence object from AI
// falls back to null rather than crashing the whole response parse.
const LenientRecurrence = RecurrenceSchema.nullable().catch(null);

export const OperationSchema = z.object({
  // operationId: AI may omit — use a placeholder; validator/service will re-number
  operationId:             z.string().optional().default('op_unknown'),
  type: z.enum([
    'create_task',
    'update_task',
    'delete_task',
    'duplicate_task',
    'reschedule_task',
    'create_recurrence',
    'replan_day',
    'split_task',
    'ask_question',
  ]),
  targetTaskId:            z.string().nullable().optional(),
  targetTaskTitle:         z.string().nullable().optional(),
  targetConfidence:        z.enum(['low', 'medium', 'high']).optional().default('medium'),
  patch:                   z.record(z.unknown()).nullable().optional(),
  newTask:                 z.record(z.unknown()).nullable().optional(),
  recurrence:              LenientRecurrence.optional(),
  reason:                  z.string().optional().default(''),
  riskLevel:               z.enum(['low', 'medium', 'high']).optional().default('medium'),
  requiresExplicitConfirm: z.boolean().optional().default(false),
});

export const DayCommandIntentSchema = z.object({
  ok: z.boolean().optional().default(true),
  commandType: z.enum([
    'create_tasks',
    'update_tasks',
    'delete_tasks',
    'duplicate_tasks',
    'reschedule_tasks',
    'replan_day',
    'make_recurring',
    'partial_repeat',
    'mixed_changes',
    'ask_clarification',
  ]),
  targetScope: z.enum([
    'specific_tasks',
    'selected_tasks',
    'all_day',
    'time_range',
    'morning',
    'afternoon',
    'evening',
    'unclear',
  ]).optional().default('unclear'),
  dateIso:              z.string().nullable().optional(),
  operations:           z.array(OperationSchema).optional().default([]),
  assumptions:          z.array(z.string()).optional().default([]),
  questions:            z.array(z.string()).optional().default([]),
  warnings:             z.array(z.string()).optional().default([]),
  confidence:           z.enum(['low', 'medium', 'high']).optional().default('medium'),
  requiresConfirmation: z.boolean().optional().default(true),
});

export type ParsedPlanningIntent  = z.infer<typeof ParsedPlanningIntentSchema>;
export type TaskReportAIAnalysis  = z.infer<typeof TaskReportAIAnalysisSchema>;
export type TaskBreakdown         = z.infer<typeof TaskBreakdownSchema>;
export type DayCommandIntent      = z.infer<typeof DayCommandIntentSchema>;
export type DayCommandOperation   = z.infer<typeof OperationSchema>;
export type DayCommandRecurrence  = z.infer<typeof RecurrenceSchema>;
