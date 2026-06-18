import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/projects?userId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' && req.query.userId
      ? req.query.userId
      : 'default-user';

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.json({ ok: true, projects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[projects/list]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/projects/:id?userId=...
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = typeof req.query.userId === 'string' && req.query.userId
      ? req.query.userId
      : 'default-user';

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!project) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }

    res.json({ ok: true, project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[projects/get]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
