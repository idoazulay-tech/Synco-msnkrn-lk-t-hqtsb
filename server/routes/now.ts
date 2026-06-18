import { Router, Request, Response } from 'express';
import { selectNowAction } from '../services/nowActionSelector.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' && req.query.userId
      ? req.query.userId
      : 'default-user';

    const excludedTaskIds: string[] =
      typeof req.query.excludedTaskIds === 'string' && req.query.excludedTaskIds
        ? req.query.excludedTaskIds.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const result = await selectNowAction(userId, excludedTaskIds);

    res.json({
      ok: true,
      task: result.task,
      reason: result.reason,
      candidateCount: result.candidateCount,
      staleCount: result.staleCount,
    });
  } catch (error) {
    console.error('[now] error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
