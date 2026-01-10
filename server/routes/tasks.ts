import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const taskRuns = await prisma.taskRun.findMany({
      where: { status: 'OPEN' },
      include: {
        taskFile: true,
        steps: {
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: [
        { urgency: 'desc' },
        { dueAt: 'asc' }
      ]
    });
    
    res.json(taskRuns);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const taskFile = await prisma.taskFile.findUnique({
      where: { id: req.params.id },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          include: { steps: true }
        },
        children: true
      }
    });
    
    if (!taskFile) {
      res.status(404).json({ error: 'Task file not found' });
      return;
    }
    
    res.json(taskFile);
  } catch (error) {
    console.error('Get task file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, parentId } = req.body;
    
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    
    const taskFile = await prisma.taskFile.create({
      data: {
        title,
        description,
        parentId,
      }
    });
    
    res.status(201).json(taskFile);
  } catch (error) {
    console.error('Create task file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/runs', async (req: Request, res: Response) => {
  try {
    const { urgency, dueAt, context } = req.body;
    
    const taskFile = await prisma.taskFile.findUnique({
      where: { id: req.params.id }
    });
    
    if (!taskFile) {
      res.status(404).json({ error: 'Task file not found' });
      return;
    }
    
    const taskRun = await prisma.taskRun.create({
      data: {
        taskFileId: req.params.id,
        urgency: urgency || 'MEDIUM',
        dueAt: dueAt ? new Date(dueAt) : undefined,
        context,
      },
      include: { taskFile: true }
    });
    
    res.status(201).json(taskRun);
  } catch (error) {
    console.error('Create task run error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/runs/:id', async (req: Request, res: Response) => {
  try {
    const { status, completedAt } = req.body;
    
    const taskRun = await prisma.taskRun.update({
      where: { id: req.params.id },
      data: {
        status,
        completedAt: status === 'DONE' ? new Date() : completedAt,
      },
      include: { taskFile: true }
    });
    
    res.json(taskRun);
  } catch (error) {
    console.error('Update task run error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
