import { Router, Request, Response } from 'express';
import { interpretInput, InterpretResult, detectConflicts, ExistingTask, RelativeAnchor } from '../services/ruleEngine.js';
import { prisma } from '../lib/prisma.js';
import { buildInquiryForMissingInfo, OrgInquiry, EntityInfo } from '../layers/decision/policies/orgInquiryQuestions.js';
import { orgStore, pendingEntities } from './org.js';
import { resolveAnchorStartIso, TimelineBlock } from '../layers/task/index.js';

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
  relativeAnchor?: RelativeAnchor | null;
  anchorResolved?: {
    startIso: string;
    resolvedFrom: string;
    blockTitle?: string;
  };
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
      const relativeAnchor = result.task.relativeAnchor;
      
      // If we have a relative anchor, we can resolve the time from the timeline
      let anchorResolved: { startIso: string; resolvedFrom: string; blockTitle?: string } | undefined;
      
      if (relativeAnchor && existingTasks?.length > 0) {
        // Convert existing tasks to timeline blocks and sort by startIso
        const timelineBlocks: TimelineBlock[] = existingTasks
          .map((t: ExistingTask) => ({
            id: t.id,
            startIso: t.startTime,
            endIso: t.endTime,
            title: t.title
          }))
          .sort((a: TimelineBlock, b: TimelineBlock) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
        
        const nowIso = new Date().toISOString();
        const resolution = resolveAnchorStartIso(relativeAnchor.type, timelineBlocks, nowIso);
        
        if (resolution.startIso) {
          anchorResolved = {
            startIso: resolution.startIso,
            resolvedFrom: resolution.resolvedFrom,
            blockTitle: resolution.blockTitle
          };
          
          // Extract date and time from resolved ISO
          const resolvedDate = new Date(resolution.startIso);
          result.task.start_date = resolvedDate.toISOString().split('T')[0];
          result.task.start_time = resolvedDate.toTimeString().slice(0, 5);
        }
      }
      
      // Only suppress date/time missingInfo when anchor was actually resolved
      // If anchor exists but couldn't be resolved (no existingTasks), still ask for date/time
      if (!result.task.start_date) {
        if (!anchorResolved) {
          missingInfo.push('date');
        }
      }
      if (!result.task.start_time) {
        if (!anchorResolved) {
          missingInfo.push('start_time');
        }
      }
      
      // If we have resolved anchor but no duration, we need to ask for duration
      if (anchorResolved && !result.task.end_time) {
        // Check if we have duration info
        const hasDuration = result.task.start_time && result.task.end_time;
        if (!hasDuration) {
          missingInfo.push('duration');
        }
      }
      
      if (missingInfo.length > 0 || result.task.needs_clarification) {
        const entityId = crypto.randomUUID();
        const entityType: 'task' | 'event' = (result.task.type === 'meeting' || result.task.type === 'appointment') ? 'event' : 'task';
        
        let duration: number | undefined;
        if (result.task.start_time && result.task.end_time) {
          const [sh, sm] = result.task.start_time.split(':').map(Number);
          const [eh, em] = result.task.end_time.split(':').map(Number);
          duration = (eh * 60 + em) - (sh * 60 + sm);
        }
        
        const pendingEntity: PendingEntity = {
          id: entityId,
          type: entityType,
          title: result.task.title,
          schedulingStatus: 'pending',
          date: result.task.start_date || undefined,
          time: result.task.start_time || undefined,
          duration,
          missingInfo: missingInfo.length > 0 ? missingInfo : (result.conflict ? ['conflict'] : ['unknown']),
          createdAtIso: new Date().toISOString(),
          relativeAnchor,
          anchorResolved,
        };
        
        pendingEntities.set(entityId, pendingEntity);
        
        const entityInfo: EntityInfo = {
          id: entityId,
          type: entityType,
          title: result.task.title,
          date: result.task.start_date || undefined,
          time: result.task.start_time || undefined,
          duration,
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
