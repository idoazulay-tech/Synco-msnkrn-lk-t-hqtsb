/**
 * Synco Open Questions Routes — Phase 1
 *
 * Isolated route group for the deferred clarification question system.
 * All routes are under /api/open-questions.
 *
 * Existing API routes are not modified. Response shapes are new and isolated.
 */

import { Router, Request, Response } from 'express';
import {
  createOpenQuestion,
  listOpenQuestions,
  answerOpenQuestion,
  dismissOpenQuestion,
  snoozeOpenQuestion,
  getOpenQuestionCount,
} from '../brain/services/openQuestions.js';

const router = Router();

// ─── GET /api/open-questions ──────────────────────────────────────────────────
// List open questions for a user. Defaults to status=open, no expired.

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId         = (req.query.userId as string) || 'default-user';
    const status         = req.query.status         as string | undefined;
    const questionType   = req.query.questionType   as string | undefined;
    const includeExpired = req.query.includeExpired === 'true';
    const limit          = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const questions = await listOpenQuestions(userId, {
      status,
      questionType,
      includeExpired,
      limit,
    });

    res.json({ ok: true, questions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('GET /api/open-questions error:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// ─── GET /api/open-questions/count ───────────────────────────────────────────
// Returns count of visible open questions for nav badge display.

router.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const count  = await getOpenQuestionCount(userId);
    res.json({ ok: true, count });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('GET /api/open-questions/count error:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// ─── POST /api/open-questions ─────────────────────────────────────────────────
// Create a new open question (used by backend hooks and manual creation).

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      questionText,
      questionType,
      priority,
      blocking,
      relatedTaskId,
      relatedTaskTitle,
      relatedEntityName,
      relatedEntityType,
      relatedProjectId,
      sourceInputText,
      sourceLearningEventId,
      sourceInputRoute,
      generationReason,
      assumptionMade,
      followUpOfQuestionId,
      expiresAt,
    } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (!questionText || typeof questionText !== 'string') {
      return res.status(400).json({ ok: false, error: 'questionText is required' });
    }
    if (!questionType || typeof questionType !== 'string') {
      return res.status(400).json({ ok: false, error: 'questionType is required' });
    }

    const { question, created } = await createOpenQuestion({
      userId,
      questionText,
      questionType,
      priority,
      blocking,
      relatedTaskId,
      relatedTaskTitle,
      relatedEntityName,
      relatedEntityType,
      relatedProjectId,
      sourceInputText,
      sourceLearningEventId,
      sourceInputRoute,
      generationReason,
      assumptionMade,
      followUpOfQuestionId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(created ? 201 : 200).json({ ok: true, question, created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/open-questions error:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// ─── POST /api/open-questions/:id/answer ─────────────────────────────────────
// Record a user's answer to an open question.

router.post('/:id/answer', async (req: Request, res: Response) => {
  try {
    const { id }         = req.params;
    const { userId, answerText, answerSource, answerConfidence } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (!answerText || typeof answerText !== 'string') {
      return res.status(400).json({ ok: false, error: 'answerText is required' });
    }

    const updated = await answerOpenQuestion(id, userId, answerText, {
      answerSource,
      answerConfidence: typeof answerConfidence === 'number' ? answerConfidence : undefined,
    });

    res.json({ ok: true, question: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`POST /api/open-questions/${req.params.id}/answer error:`, msg);
    const statusCode = msg.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ ok: false, error: msg });
  }
});

// ─── POST /api/open-questions/:id/dismiss ────────────────────────────────────
// Permanently dismiss an open question.

router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id }    = req.params;
    const { userId } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    const updated = await dismissOpenQuestion(id, userId);
    res.json({ ok: true, question: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`POST /api/open-questions/${req.params.id}/dismiss error:`, msg);
    const statusCode = msg.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ ok: false, error: msg });
  }
});

// ─── POST /api/open-questions/:id/snooze ─────────────────────────────────────
// Snooze a question until a given time (or 24h by default).

router.post('/:id/snooze', async (req: Request, res: Response) => {
  try {
    const { id }           = req.params;
    const { userId, until } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    const updated = await snoozeOpenQuestion(
      id,
      userId,
      until ? new Date(until) : undefined,
    );

    res.json({ ok: true, question: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`POST /api/open-questions/${req.params.id}/snooze error:`, msg);
    const statusCode = msg.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ ok: false, error: msg });
  }
});

export default router;
