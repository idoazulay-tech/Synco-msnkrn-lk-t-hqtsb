import { Router, Request, Response } from 'express';
import { interpretInput } from '../services/ruleEngine.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, userContext } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    
    const result = interpretInput(text, userContext);
    
    await prisma.insightLog.create({
      data: {
        sourceText: text,
        summary: result.insights.summary,
        detected: result.insights.detected as any,
      }
    });
    
    if (result.autoAction && result.intent === 'CREATE_TASK' && result.extracted.title) {
      const taskFile = await prisma.taskFile.create({
        data: {
          title: result.extracted.title,
        }
      });
      
      const taskRun = await prisma.taskRun.create({
        data: {
          taskFileId: taskFile.id,
          urgency: result.extracted.urgency || 'MEDIUM',
          dueAt: result.extracted.dueAt,
        }
      });
      
      res.json({
        ...result,
        action: {
          type: 'TASK_CREATED',
          taskFile,
          taskRun,
        }
      });
      return;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Quick input error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
