import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();
const DEFAULT_USER = 'default-user';

function taskToPrismaData(task: any, userId: string) {
  return {
    id: task.id,
    userId,
    title: task.title,
    description: task.description || null,
    location: task.location || null,
    startTime: new Date(task.startTime),
    endTime: new Date(task.endTime),
    duration: typeof task.duration === 'number' ? task.duration : 60,
    status: task.status || 'pending',
    priority: task.priority || null,
    flexibility: task.flexibility || null,
    isAllDay: task.isAllDay || false,
    isRecurring: !!task.repeat,
    recurringRuleJson: task.repeat || null,
    excludedDates: task.excludedDates || [],
    isOccurrenceException: task.isOccurrenceException || false,
    masterTaskId: task.masterTaskId || null,
    occurrenceDate: task.occurrenceDate || null,
    tagsJson: task.tags || [],
    historyJson: task.history || [],
    createdFromJson: task.createdFrom || null,
    completedAt: task.completedAt ? new Date(task.completedAt) : null,
  };
}

function prismaToTask(record: any) {
  return {
    id: record.id,
    title: record.title,
    description: record.description || undefined,
    location: record.location || undefined,
    startTime: record.startTime.toISOString(),
    endTime: record.endTime.toISOString(),
    duration: record.duration,
    status: record.status,
    priority: record.priority || undefined,
    flexibility: record.flexibility || undefined,
    isAllDay: record.isAllDay,
    repeat: record.recurringRuleJson || null,
    excludedDates: record.excludedDates || [],
    isOccurrenceException: record.isOccurrenceException,
    masterTaskId: record.masterTaskId || undefined,
    occurrenceDate: record.occurrenceDate || undefined,
    tags: record.tagsJson || [],
    history: (record.historyJson as any[] || []).map((h: any) => ({
      ...h,
      timestamp: h.timestamp ? new Date(h.timestamp) : new Date(),
    })),
    createdFrom: record.createdFromJson || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() || undefined,
    // Project linkage fields (Build Pack 4A)
    projectId:     record.projectId     ?? undefined,
    projectStepId: record.projectStepId ?? undefined,
    parentTaskId:  record.parentTaskId  ?? undefined,
    firstStep:     record.firstStep     ?? undefined,
  };
}

// GET /api/user-tasks?userId=default-user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER;
    const records = await prisma.userTask.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startTime: 'asc' },
    });
    res.json(records.map(prismaToTask));
  } catch (error) {
    console.error('GET /api/user-tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user-tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId = DEFAULT_USER, ...task } = req.body;
    if (!task.id || !task.title) {
      return res.status(400).json({ error: 'id and title are required' });
    }
    const data = taskToPrismaData(task, userId);
    const record = await prisma.userTask.upsert({
      where: { id: task.id },
      create: data,
      update: data,
    });
    res.status(201).json(prismaToTask(record));
  } catch (error) {
    console.error('POST /api/user-tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/user-tasks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { userId = DEFAULT_USER, ...task } = req.body;
    const data = taskToPrismaData({ ...task, id: req.params.id }, userId);
    const record = await prisma.userTask.upsert({
      where: { id: req.params.id },
      create: data,
      update: data,
    });
    res.json(prismaToTask(record));
  } catch (error) {
    console.error('PUT /api/user-tasks/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/user-tasks/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.userTask.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    console.error('DELETE /api/user-tasks/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user-tasks/:id/complete
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { completed, historyJson } = req.body;
    const record = await prisma.userTask.update({
      where: { id: req.params.id },
      data: {
        status: completed ? 'completed' : 'not_completed',
        completedAt: completed ? new Date() : null,
        ...(historyJson ? { historyJson } : {}),
      },
    });
    res.json(prismaToTask(record));
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    console.error('POST /api/user-tasks/:id/complete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user-tasks/batch — bulk upsert for migration from localStorage
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { userId = DEFAULT_USER, tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }
    const results = await Promise.allSettled(
      tasks.map((task: any) => {
        const data = taskToPrismaData(task, userId);
        return prisma.userTask.upsert({
          where: { id: task.id },
          create: data,
          update: data,
        });
      })
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    res.json({ ok: true, succeeded, failed });
  } catch (error) {
    console.error('POST /api/user-tasks/batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
