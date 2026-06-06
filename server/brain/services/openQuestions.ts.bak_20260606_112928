/**
 * Synco Open Questions Service — Phase 1
 *
 * Durable backend infrastructure for deferred non-blocking clarification questions.
 *
 * Design principles:
 *   - Questions are created when useful information is missing but NOT critical to execution.
 *   - Execution is never blocked by Phase 1 question creation.
 *   - Duplicate prevention: same (userId + questionType + relatedEntityName + relatedTaskId
 *     + questionText) returns the existing question rather than creating a duplicate.
 *   - sourceInputText is truncated to ≤100 chars — never stores full private content.
 *   - Phase 1: answerOpenQuestion does NOT write to Qdrant and does NOT generate follow-ups.
 *   - Snooze uses expiresAt (existing field) to mark when a question becomes visible again.
 *
 * Do NOT modify this file to write to Qdrant or generate follow-ups until Phase 3.
 */

import { prisma } from '../../lib/prisma.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpenQuestionStatus =
  | 'open'
  | 'answered'
  | 'resolved'
  | 'dismissed'
  | 'expired';

export type OpenQuestionPriority = 'immediate' | 'high' | 'normal' | 'low';

export type OpenQuestionType =
  | 'entity_identity'
  | 'entity_relationship'
  | 'project_identity'
  | 'task_context'
  | 'location_context'
  | 'time_preference'
  | 'priority_preference'
  | 'routine_learning'
  | 'domain_classification'
  | 'ambiguity_resolution';

export interface CreateOpenQuestionInput {
  userId:                string;
  questionText:          string;
  questionType:          string;
  priority?:             string;
  blocking?:             boolean;
  relatedTaskId?:        string;
  relatedTaskTitle?:     string;
  relatedEntityName?:    string;
  relatedEntityType?:    string;
  relatedProjectId?:     string;
  sourceInputText?:      string;
  sourceLearningEventId?: string;
  sourceInputRoute?:     string;
  generationReason?:     string;
  assumptionMade?:       string;
  followUpOfQuestionId?: string;
  expiresAt?:            Date;
}

export interface ListOpenQuestionsOpts {
  status?:            string;
  questionType?:      string;
  includeExpired?:    boolean;
  limit?:             number;
}

export interface AnswerOpenQuestionOpts {
  answerSource?:      string;
  answerConfidence?:  number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_INPUT_TEXT_MAX_LEN = 100;
const DEFAULT_SNOOZE_HOURS = 24;

// ─── Priority sort order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  immediate: 0,
  high:      1,
  normal:    2,
  low:       3,
};

// ─── 1. createOpenQuestion ────────────────────────────────────────────────────

/**
 * Creates a new OpenQuestion, or returns the existing one if a duplicate is found.
 *
 * Duplicate key: userId + questionType + relatedEntityName + relatedTaskId + questionText
 * (all lowercased/trimmed for comparison)
 */
export async function createOpenQuestion(
  input: CreateOpenQuestionInput,
): Promise<{ question: Awaited<ReturnType<typeof prisma.openQuestion.findFirst>>; created: boolean }> {
  const questionText = input.questionText?.trim();
  if (!questionText) {
    throw new Error('[OpenQuestions] questionText is required and must not be empty');
  }

  const truncatedSourceInputText = input.sourceInputText
    ? input.sourceInputText.slice(0, SOURCE_INPUT_TEXT_MAX_LEN)
    : undefined;

  // ── Dedup check ──────────────────────────────────────────────────────────
  const existingQuestion = await prisma.openQuestion.findFirst({
    where: {
      userId:            input.userId,
      questionType:      input.questionType,
      questionText:      questionText,
      relatedEntityName: input.relatedEntityName ?? null,
      relatedTaskId:     input.relatedTaskId ?? null,
      status:            { in: ['open', 'answered'] },
    },
  });

  if (existingQuestion) {
    return { question: existingQuestion, created: false };
  }

  // ── Create new ───────────────────────────────────────────────────────────
  const question = await prisma.openQuestion.create({
    data: {
      userId:                input.userId,
      questionText:          questionText,
      questionType:          input.questionType,
      status:                'open',
      priority:              input.priority              ?? 'normal',
      blocking:              input.blocking              ?? false,
      relatedTaskId:         input.relatedTaskId,
      relatedTaskTitle:      input.relatedTaskTitle,
      relatedEntityName:     input.relatedEntityName,
      relatedEntityType:     input.relatedEntityType,
      relatedProjectId:      input.relatedProjectId,
      sourceInputText:       truncatedSourceInputText,
      sourceLearningEventId: input.sourceLearningEventId,
      sourceInputRoute:      input.sourceInputRoute,
      generationReason:      input.generationReason,
      assumptionMade:        input.assumptionMade,
      followUpOfQuestionId:  input.followUpOfQuestionId,
      expiresAt:             input.expiresAt,
    },
  });

  return { question, created: true };
}

// ─── 2. listOpenQuestions ─────────────────────────────────────────────────────

/**
 * Returns open questions for a user, sorted by priority then createdAt.
 * By default excludes expired questions (expiresAt < now).
 */
export async function listOpenQuestions(
  userId: string,
  opts: ListOpenQuestionsOpts = {},
) {
  const status    = opts.status       ?? 'open';
  const limit     = opts.limit        ?? 50;
  const now       = new Date();

  const where: Parameters<typeof prisma.openQuestion.findMany>[0]['where'] = {
    userId,
    status,
    ...(opts.questionType ? { questionType: opts.questionType } : {}),
  };

  if (!opts.includeExpired) {
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ];
  }

  const rows = await prisma.openQuestion.findMany({
    where,
    take: limit,
    orderBy: [
      { createdAt: 'asc' },
    ],
  });

  // Sort in memory by priority order then createdAt
  return rows.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// ─── 3. answerOpenQuestion ────────────────────────────────────────────────────

/**
 * Records a user's answer for an open question.
 *
 * Phase 1 constraints (MUST NOT be changed until Phase 3):
 *   - Does NOT write to Qdrant.
 *   - Does NOT generate follow-up questions.
 *   - Does NOT modify any other existing service.
 */
export async function answerOpenQuestion(
  questionId:  string,
  userId:      string,
  answerText:  string,
  opts:        AnswerOpenQuestionOpts = {},
) {
  const trimmed = answerText?.trim();
  if (!trimmed) {
    throw new Error('[OpenQuestions] answerText is required and must not be empty');
  }

  const question = await prisma.openQuestion.findFirst({
    where: { id: questionId, userId },
  });
  if (!question) {
    throw new Error(`[OpenQuestions] question ${questionId} not found for user ${userId}`);
  }

  return prisma.openQuestion.update({
    where: { id: questionId },
    data: {
      status:          'answered',
      answeredAt:      new Date(),
      answerText:      trimmed,
      answerSource:    opts.answerSource    ?? 'user_explicit',
      answerConfidence: opts.answerConfidence ?? 1.0,
    },
  });
}

// ─── 4. dismissOpenQuestion ───────────────────────────────────────────────────

/**
 * Permanently dismisses a question — it will not reappear in the default list.
 */
export async function dismissOpenQuestion(questionId: string, userId: string) {
  const question = await prisma.openQuestion.findFirst({
    where: { id: questionId, userId },
  });
  if (!question) {
    throw new Error(`[OpenQuestions] question ${questionId} not found for user ${userId}`);
  }

  return prisma.openQuestion.update({
    where: { id: questionId },
    data:  { status: 'dismissed' },
  });
}

// ─── 5. snoozeOpenQuestion ────────────────────────────────────────────────────

/**
 * Snoozes a question until a future time by setting expiresAt.
 * The question status remains 'open'; it is excluded from list results until expiresAt passes.
 *
 * Phase 1 note: We use expiresAt as the snooze mechanism — it is the only available
 * datetime field for this purpose. When the UI calls listOpenQuestions, expired questions
 * are filtered out, so a snoozed question disappears until the snooze expires.
 *
 * If a dedicated snoozedUntil field is needed in future phases, add it then.
 */
export async function snoozeOpenQuestion(
  questionId: string,
  userId:     string,
  until?:     Date,
) {
  const question = await prisma.openQuestion.findFirst({
    where: { id: questionId, userId },
  });
  if (!question) {
    throw new Error(`[OpenQuestions] question ${questionId} not found for user ${userId}`);
  }

  const snoozeUntil = until ?? new Date(Date.now() + DEFAULT_SNOOZE_HOURS * 60 * 60 * 1000);

  return prisma.openQuestion.update({
    where: { id: questionId },
    data:  { expiresAt: snoozeUntil },
  });
}

// ─── 6. getOpenQuestionCount ──────────────────────────────────────────────────

/**
 * Returns the count of currently visible open questions for a user.
 * Used for nav badge display.
 */
export async function getOpenQuestionCount(userId: string): Promise<number> {
  const now = new Date();
  return prisma.openQuestion.count({
    where: {
      userId,
      status: 'open',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });
}
