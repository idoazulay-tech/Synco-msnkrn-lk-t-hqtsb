import { Router, Request, Response } from 'express';
import { organizeIntake, commitIntakePreview } from '../services/intakeOrganizerService.js';
import type { SyncoIntakePreview } from '../services/intakeOrganizerService.js';

const router = Router();

// POST /api/intake/preview
// Parses raw text → full structured SyncoIntakePreview (no DB write).
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { text, userId = 'default-user' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ ok: false, error: 'נא להזין טקסט' });
      return;
    }

    const preview = await organizeIntake(text.trim(), userId);

    const summary = buildSummary(preview);

    res.json({ ok: true, preview, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[intake/preview]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/intake/commit
// Persists a confirmed preview to DB.
router.post('/commit', async (req: Request, res: Response) => {
  try {
    const { userId = 'default-user', preview, rawText } = req.body as {
      userId?: string;
      preview: SyncoIntakePreview;
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

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(preview: SyncoIntakePreview): string {
  const parts: string[] = [];

  if (preview.nowAction) {
    parts.push(`פעולה אחת עכשיו: "${preview.nowAction.title}"`);
  }
  if (preview.projects.length > 0) {
    parts.push(`${preview.projects.length} פרויקטים עם שלבים`);
  }
  if (preview.todayTasks.length > 0) {
    parts.push(`${preview.todayTasks.length} משימות להיום`);
  }
  if (preview.laterTasks.length > 0) {
    parts.push(`${preview.laterTasks.length} משימות להמשך`);
  }
  if (preview.notes.length > 0) {
    parts.push(`${preview.notes.length} הערות הקשר`);
  }

  if (parts.length === 0) {
    return 'לא זוהו פריטים ברורים — נסה לנסח מחדש';
  }

  return parts.join(' | ') + '.';
}

export default router;
