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

    if (projects.length === 0) {
      res.json({ ok: true, projects: [] });
      return;
    }

    // Fetch linked tasks for all projects in one query
    const projectIds = projects.map(p => p.id);
    const linkedTasks = await prisma.userTask.findMany({
      where: { userId, projectId: { in: projectIds }, deletedAt: null },
      select: { id: true, projectId: true, status: true },
    });

    const tasksByProject = new Map<string, typeof linkedTasks>();
    for (const t of linkedTasks) {
      if (!t.projectId) continue;
      if (!tasksByProject.has(t.projectId)) tasksByProject.set(t.projectId, []);
      tasksByProject.get(t.projectId)!.push(t);
    }

    const enriched = projects.map(proj => {
      const tasks = tasksByProject.get(proj.id) ?? [];
      const completedSteps = proj.steps.filter(s => s.status === 'completed').length;
      const nextStep = proj.steps.find(s => s.status !== 'completed');

      return {
        ...proj,
        // Computed metrics
        totalSteps:          proj.steps.length,
        completedSteps,
        linkedTasks:         tasks.length,
        completedLinkedTasks: tasks.filter(t => t.status === 'completed').length,
        nextActionTitle:     nextStep?.title ?? null,
        progressRate:        proj.steps.length > 0
          ? completedSteps / proj.steps.length
          : 0,
      };
    });

    res.json({ ok: true, projects: enriched });
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

    // Fetch linked tasks with scheduling info
    const linkedTasks = await prisma.userTask.findMany({
      where: { userId, projectId: id, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        startTime: true,
        endTime: true,
        projectStepId: true,
        firstStep: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const completedSteps = project.steps.filter(s => s.status === 'completed').length;
    const nextStep = project.steps.find(s => s.status !== 'completed');

    res.json({
      ok: true,
      project: {
        ...project,
        totalSteps:           project.steps.length,
        completedSteps,
        linkedTasks:          linkedTasks.length,
        completedLinkedTasks: linkedTasks.filter(t => t.status === 'completed').length,
        nextActionTitle:      nextStep?.title ?? null,
        progressRate:         project.steps.length > 0
          ? completedSteps / project.steps.length
          : 0,
        scheduledTasks: linkedTasks,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
    console.error('[projects/get]', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
