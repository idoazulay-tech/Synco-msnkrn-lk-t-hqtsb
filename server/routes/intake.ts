import { Router, Request, Response } from 'express';
import { organizeIntake, commitIntakePreview } from '../services/intakeOrganizerService.js';
import type { IntakePreview } from '../services/intakeOrganizerService.js';

const router = Router();

// POST /api/intake/preview
// Parses raw text and returns a structured preview without writing to DB.
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { text, userId = 'default-user' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ ok: false, error: 'text is required' });
      return;
    }

    const preview = await organizeIntake(text.trim(), userId);
    res.json({ ok: true, preview });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[intake/preview]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/intake/commit
// Persists a confirmed preview to DB (IntakeRecord + UserTasks + optional Project).
router.post('/commit', async (req: Request, res: Response) => {
  try {
    const { userId = 'default-user', preview, rawText } = req.body as {
      userId?: string;
      preview: IntakePreview;
      rawText: string;
    };

    if (!preview || typeof preview !== 'object') {
      res.status(400).json({ ok: false, error: 'preview is required' });
      return;
    }
    if (!rawText || typeof rawText !== 'string') {
      res.status(400).json({ ok: false, error: 'rawText is required' });
      return;
    }

    const result = await commitIntakePreview(userId, preview, rawText);
    res.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[intake/commit]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
