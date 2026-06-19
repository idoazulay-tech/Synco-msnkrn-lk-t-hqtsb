import { Router, Request, Response } from 'express';
import {
  getOverview,
  getFunnel,
  getProjectMetrics,
} from '../services/metricsService.js';

const router = Router();

// GET /api/metrics/overview?userId=default-user
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const { totals, rates } = await getOverview(userId);
    res.json({ ok: true, userId, totals, rates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[metrics/overview]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/metrics/funnel?userId=default-user
router.get('/funnel', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const { funnel, conversionRates } = await getFunnel(userId);
    res.json({ ok: true, userId, funnel, conversionRates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[metrics/funnel]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/metrics/projects?userId=default-user
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const projects = await getProjectMetrics(userId);
    res.json({ ok: true, userId, projects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[metrics/projects]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
