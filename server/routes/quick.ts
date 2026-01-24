import { Router, Request, Response } from 'express';
import { interpretInput, InterpretResult, detectConflicts, ExistingTask } from '../services/ruleEngine.js';
import { prisma } from '../lib/prisma.js';
import { buildInquiryForMissingInfo, OrgInquiry, EntityInfo } from '../layers/decision/policies/orgInquiryQuestions.js';
import { orgStore, pendingEntities } from './org.js';

const router = Router();

interface PendingEntity {
  id: string;
  type: 'task' | 'event';
  title: string;
  schedulingStatus: 'pending' | 'scheduled';
  date?: string;
  time?: string;
  duration?: number;
  missingInfo: string[];
  createdAtIso: string;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, existingTasks } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    
    const result: InterpretResult = interpretInput(text);
    
    // Check for conflicts if we have task info and existing tasks
    if (result.mode === 'task_or_event' && result.task && existingTasks?.length > 0) {
      const { start_date, start_time, end_time } = result.task;
      
      if (start_date && start_time) {
        const newStartTime = new Date(`${start_date}T${start_time}`);
        const newEndTime = end_time 
          ? new Date(`${start_date}T${end_time}`)
          : new Date(newStartTime.getTime() + 30 * 60 * 1000); // Default 30 min
        
        const conflict = detectConflicts(
          result.task.title,
          newStartTime,
          newEndTime,
          existingTasks as ExistingTask[]
        );
        
        if (conflict.hasConflict) {
          result.conflict = conflict;
          result.task.needs_clarification = true;
          result.task.clarifying_question = conflict.reorganizationQuestion || null;
        }
      }
    }
    
    await prisma.insightLog.create({
      data: {
        sourceText: text,
        summary: result.mode === 'task_or_event' 
          ? (result.task?.title || 'משימה')
          : (result.journal?.title || 'יומן'),
        detected: {
          mode: result.mode,
          taskType: result.task?.type,
          mood: result.journal?.mood_hint,
        },
      }
    });
    
    if (result.mode === 'task_or_event' && result.task) {
      const missingInfo: string[] = [];
      
      if (!result.task.start_date) {
        missingInfo.push('date');
      }
      if (!result.task.start_time) {
        missingInfo.push('start_time');
      }
      
      if (missingInfo.length > 0 || result.task.needs_clarification) {
        const entityId = crypto.randomUUID();
        const entityType = result.task.type === 'event' ? 'event' : 'task';
        
        const pendingEntity: PendingEntity = {
          id: entityId,
          type: entityType,
          title: result.task.title,
          schedulingStatus: 'pending',
          date: result.task.start_date,
          time: result.task.start_time,
          duration: result.task.duration_minutes,
          missingInfo: missingInfo.length > 0 ? missingInfo : (result.conflict ? ['conflict'] : ['unknown']),
          createdAtIso: new Date().toISOString(),
        };
        
        pendingEntities.set(entityId, pendingEntity);
        
        const entityInfo: EntityInfo = {
          id: entityId,
          type: entityType,
          title: result.task.title,
          date: result.task.start_date,
          time: result.task.start_time,
          duration: result.task.duration_minutes,
        };
        
        let inquiry: OrgInquiry | null = null;
        
        if (result.conflict && result.conflict.hasConflict) {
          inquiry = {
            id: crypto.randomUUID(),
            createdAtIso: new Date().toISOString(),
            status: 'pending',
            reason: 'conflict',
            entity: {
              type: entityType,
              id: entityId,
              title: result.task.title,
            },
            message: {
              titleHebrew: 'חפיפה בזמנים',
              bodyHebrew: result.conflict.reorganizationQuestion || `יש חפיפה עם "${result.conflict.conflictingTasks?.[0]?.title || 'משימה קיימת'}"`,
            },
            question: {
              id: crypto.randomUUID(),
              textHebrew: result.conflict.reorganizationQuestion || 'מה לעשות?',
              expectedAnswerType: 'choice',
              options: ['להזיז את המשימה החדשה', 'להחליף את המשימה הקיימת', 'להשאיר חפיפה'],
              relatedEntityId: entityId,
            },
            meta: {
              missingInfo: ['conflict'],
              conflictId: result.conflict.conflictingTasks?.[0]?.id,
              relatedIds: result.conflict.conflictingTasks?.map(t => t.id) || [],
            },
          };
        } else if (missingInfo.length > 0) {
          const inquiryData = buildInquiryForMissingInfo(entityInfo, missingInfo);
          inquiry = {
            ...inquiryData,
            id: crypto.randomUUID(),
            createdAtIso: new Date().toISOString(),
            status: 'pending',
          };
        }
        
        if (inquiry) {
          orgStore.pendingInquiries.push(inquiry);
          orgStore.lastQuestionContext = {
            inquiryId: inquiry.id,
            questionId: inquiry.question.id,
            expectedAnswerType: inquiry.question.expectedAnswerType,
            options: inquiry.question.options,
          };
        }
        
        res.json({
          ...result,
          pendingEntity,
          inquiry,
          action: {
            type: 'PENDING_CREATED',
            redirectToOrg: true,
            message: 'נוצרה משימה בהמתנה',
          }
        });
        return;
      }
      
      const taskFile = await prisma.taskFile.create({
        data: {
          title: result.task.title,
        }
      });
      
      const dueAt = result.task.start_date 
        ? new Date(`${result.task.start_date}${result.task.start_time ? `T${result.task.start_time}` : 'T12:00'}`)
        : undefined;
      
      const taskRun = await prisma.taskRun.create({
        data: {
          taskFileId: taskFile.id,
          urgency: result.task.priority === 'high' ? 'HIGH' : result.task.priority === 'low' ? 'LOW' : 'MEDIUM',
          dueAt,
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
