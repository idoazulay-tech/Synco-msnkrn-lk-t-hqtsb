import { Router, Request, Response } from 'express';
import { buildInquiryForMissingInfo, getNextQuestionForEntity, OrgInquiry, EntityInfo } from '../layers/decision/policies/orgInquiryQuestions.js';
import { parseAnswerToUpdate } from '../layers/intent/utils/answerParsers.js';
import { prisma } from '../lib/prisma.js';
import { 
  processAnswerInContext, 
  applyEvidenceToEntity,
  createActiveContext,
  getActiveContextForEntity
} from '../layers/context/contextResolutionEngine.js';
import type { QuestionGoal } from '../layers/context/activeQuestionContext.js';

const router = Router();

interface OrgStore {
  pendingInquiries: OrgInquiry[];
  lastQuestionContext: {
    inquiryId: string;
    questionId: string;
    expectedAnswerType: string;
    options?: string[];
  } | null;
  decisionLogs: DecisionLogEntry[];
}

interface DecisionLogEntry {
  id: string;
  timestamp: string;
  situationKey: string;
  userChoice: string;
  entityId: string;
  entityType: 'task' | 'event';
}

const orgStore: OrgStore = {
  pendingInquiries: [],
  lastQuestionContext: null,
  decisionLogs: [],
};

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

const pendingEntities: Map<string, PendingEntity> = new Map();

router.get('/feed', async (req: Request, res: Response) => {
  try {
    const pending = orgStore.pendingInquiries.filter(i => i.status === 'pending');
    const firstPending = pending.length > 0 ? pending[0] : null;
    
    res.json({
      pendingInquiries: pending,
      pendingQuestion: firstPending?.question || null,
      lastQuestionContext: orgStore.lastQuestionContext,
      summary: {
        pendingCount: pending.length,
        hasActiveQuestion: !!firstPending,
      }
    });
  } catch (error) {
    console.error('Org feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/respond', async (req: Request, res: Response) => {
  try {
    const { inquiryId, answer } = req.body;
    
    // CCR Rule: Accept any answer - never reject
    if (!answer) {
      res.status(400).json({ error: 'answer is required' });
      return;
    }
    
    // Find inquiry, but CCR allows processing even without perfect match
    const inquiryIndex = orgStore.pendingInquiries.findIndex(i => i.id === inquiryId);
    let inquiry = inquiryIndex !== -1 ? orgStore.pendingInquiries[inquiryIndex] : null;
    
    // CCR: If no exact inquiry match, try to find any pending inquiry for this entity
    if (!inquiry) {
      inquiry = orgStore.pendingInquiries.find(i => i.status === 'pending') || null;
    }
    
    if (!inquiry) {
      // CCR: Even without inquiry, process the answer for any active context
      const contextResult = processAnswerInContext(answer);
      res.json({
        success: true,
        message: 'תשובה התקבלה',
        contextResolution: contextResult
      });
      return;
    }
    
    // CCR: Process answer in context first - extract ALL possible evidence
    const contextResult = processAnswerInContext(answer, inquiry.entity.id);
    
    const entity = pendingEntities.get(inquiry.entity.id);
    const lastContext = orgStore.lastQuestionContext;
    
    // Also use legacy parser for backward compatibility
    const parsedAnswer = parseAnswerToUpdate(
      answer,
      lastContext?.expectedAnswerType || inquiry.question.expectedAnswerType,
      lastContext?.options || inquiry.question.options
    );
    
    const updatedMissingInfo = [...inquiry.meta.missingInfo];
    let entityUpdate: Partial<PendingEntity> = {};
    let conflictResolved = false;
    
    // CCR: Apply evidence from contextResolution (CCR engine)
    for (const evidence of contextResult.extractedEvidence) {
      if (evidence.type === 'time' && evidence.value) {
        entityUpdate.time = evidence.value;
        const idx = updatedMissingInfo.indexOf('time');
        if (idx > -1) updatedMissingInfo.splice(idx, 1);
        const idx2 = updatedMissingInfo.indexOf('start_time');
        if (idx2 > -1) updatedMissingInfo.splice(idx2, 1);
      }
      if (evidence.type === 'date' && evidence.value) {
        entityUpdate.date = evidence.value;
        const idx = updatedMissingInfo.indexOf('date');
        if (idx > -1) updatedMissingInfo.splice(idx, 1);
      }
      if (evidence.type === 'duration' && evidence.value) {
        entityUpdate.duration = parseInt(evidence.value) || 30;
        const idx = updatedMissingInfo.indexOf('duration');
        if (idx > -1) updatedMissingInfo.splice(idx, 1);
      }
      if (evidence.type === 'conflict_resolution') {
        const idx = updatedMissingInfo.indexOf('conflict');
        if (idx > -1) updatedMissingInfo.splice(idx, 1);
        conflictResolved = true;
      }
    }
    
    // Fallback: Also apply legacy parser results (for backward compatibility)
    if (parsedAnswer.field === 'time' && parsedAnswer.value && !entityUpdate.time) {
      entityUpdate.time = parsedAnswer.value;
      const idx = updatedMissingInfo.indexOf('time');
      if (idx > -1) updatedMissingInfo.splice(idx, 1);
      const idx2 = updatedMissingInfo.indexOf('start_time');
      if (idx2 > -1) updatedMissingInfo.splice(idx2, 1);
    }
    
    if (parsedAnswer.field === 'date' && parsedAnswer.value && !entityUpdate.date) {
      entityUpdate.date = parsedAnswer.value;
      const idx = updatedMissingInfo.indexOf('date');
      if (idx > -1) updatedMissingInfo.splice(idx, 1);
    }
    
    if (parsedAnswer.field === 'duration' && parsedAnswer.value && !entityUpdate.duration) {
      entityUpdate.duration = parseInt(parsedAnswer.value) || 30;
      const idx = updatedMissingInfo.indexOf('duration');
      if (idx > -1) updatedMissingInfo.splice(idx, 1);
    }
    
    if (inquiry.reason === 'conflict' || inquiry.meta.missingInfo.includes('conflict')) {
      const conflictChoices = ['להזיז את המשימה החדשה', 'להחליף את המשימה הקיימת', 'להשאיר חפיפה'];
      const answerLower = answer.trim();
      
      if (conflictChoices.some(c => answerLower.includes(c) || c.includes(answerLower)) ||
          answerLower.includes('להזיז') || answerLower.includes('להחליף') || answerLower.includes('חפיפה')) {
        const idx = updatedMissingInfo.indexOf('conflict');
        if (idx > -1) updatedMissingInfo.splice(idx, 1);
        conflictResolved = true;
      }
    }
    
    if (entity) {
      Object.assign(entity, entityUpdate);
      entity.missingInfo = updatedMissingInfo;
    }
    
    const situationKey = buildSituationKey(inquiry);
    addDecisionLog({
      situationKey,
      userChoice: answer,
      entityId: inquiry.entity.id,
      entityType: inquiry.entity.type,
    });
    
    if (updatedMissingInfo.length > 0) {
      const entityInfo: EntityInfo = {
        id: inquiry.entity.id,
        type: inquiry.entity.type,
        title: inquiry.entity.title,
        date: entity?.date,
        time: entity?.time,
        duration: entity?.duration,
      };
      
      const nextQuestion = getNextQuestionForEntity(
        entityInfo,
        updatedMissingInfo,
        inquiry.meta.missingInfo.filter(m => !updatedMissingInfo.includes(m))
      );
      
      if (nextQuestion) {
        inquiry.question = nextQuestion;
        inquiry.meta.missingInfo = updatedMissingInfo;
        orgStore.lastQuestionContext = {
          inquiryId: inquiry.id,
          questionId: nextQuestion.id,
          expectedAnswerType: nextQuestion.expectedAnswerType,
          options: nextQuestion.options,
        };
        
        res.json({
          resolved: false,
          stillPending: true,
          updatedInquiry: inquiry,
          message: 'עדיין צריך מידע נוסף',
          contextResolution: {
            goalAchieved: contextResult.goalAchieved,
            extractedEvidence: contextResult.extractedEvidence,
            nextAction: contextResult.nextAction
          }
        });
        return;
      }
    }
    
    inquiry.status = 'resolved';
    
    if (entity) {
      entity.schedulingStatus = 'scheduled';
      
      try {
        const taskFile = await prisma.taskFile.create({
          data: {
            title: entity.title,
          }
        });
        
        let dueAt: Date | undefined;
        if (entity.date) {
          const timeStr = entity.time || '12:00';
          dueAt = new Date(`${entity.date}T${timeStr}`);
        }
        
        const taskRun = await prisma.taskRun.create({
          data: {
            taskFileId: taskFile.id,
            urgency: 'MEDIUM',
            dueAt,
          }
        });
        
        res.json({
          resolved: true,
          stillPending: false,
          entity: {
            id: entity.id,
            title: entity.title,
            schedulingStatus: 'scheduled',
            date: entity.date,
            time: entity.time,
            duration: entity.duration,
          },
          taskFile,
          taskRun,
          message: `שיבצתי את "${entity.title}" בלוז`,
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        res.json({
          resolved: true,
          stillPending: false,
          entity: entity,
          message: `שיבצתי את "${entity.title}" בלוז`,
        });
      }
    } else {
      res.json({
        resolved: true,
        stillPending: false,
        message: 'הבירור הושלם',
      });
    }
  } catch (error) {
    console.error('Org respond error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create-pending', async (req: Request, res: Response) => {
  try {
    const { title, type, date, time, duration, missingInfo } = req.body;
    
    if (!title || !type) {
      res.status(400).json({ error: 'title and type are required' });
      return;
    }
    
    const entityId = crypto.randomUUID();
    
    const pendingEntity: PendingEntity = {
      id: entityId,
      type: type as 'task' | 'event',
      title,
      schedulingStatus: 'pending',
      date,
      time,
      duration,
      missingInfo: missingInfo || [],
      createdAtIso: new Date().toISOString(),
    };
    
    pendingEntities.set(entityId, pendingEntity);
    
    if (missingInfo && missingInfo.length > 0) {
      const entityInfo: EntityInfo = {
        id: entityId,
        type: type as 'task' | 'event',
        title,
        date,
        time,
        duration,
      };
      
      const inquiryData = buildInquiryForMissingInfo(entityInfo, missingInfo);
      const inquiry: OrgInquiry = {
        ...inquiryData,
        id: crypto.randomUUID(),
        createdAtIso: new Date().toISOString(),
        status: 'pending',
      };
      
      orgStore.pendingInquiries.push(inquiry);
      orgStore.lastQuestionContext = {
        inquiryId: inquiry.id,
        questionId: inquiry.question.id,
        expectedAnswerType: inquiry.question.expectedAnswerType,
        options: inquiry.question.options,
      };
      
      res.json({
        entity: pendingEntity,
        inquiry,
        redirectToOrg: true,
        message: 'נוצרה משימה בהמתנה, יש לענות על השאלה בדף ארגון',
      });
    } else {
      pendingEntity.schedulingStatus = 'scheduled';
      res.json({
        entity: pendingEntity,
        inquiry: null,
        redirectToOrg: false,
        message: 'המשימה נוצרה בהצלחה',
      });
    }
  } catch (error) {
    console.error('Create pending error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending-entities', async (req: Request, res: Response) => {
  try {
    const entities = Array.from(pendingEntities.values());
    res.json({
      entities,
      pendingCount: entities.filter(e => e.schedulingStatus === 'pending').length,
      scheduledCount: entities.filter(e => e.schedulingStatus === 'scheduled').length,
    });
  } catch (error) {
    console.error('Get pending entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function buildSituationKey(inquiry: OrgInquiry): string {
  const reason = inquiry.reason;
  const entityType = inquiry.entity.type;
  const firstMissing = inquiry.meta.missingInfo[0] || 'unknown';
  
  return `${reason}:${entityType}:${firstMissing}`;
}

function addDecisionLog(entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>) {
  orgStore.decisionLogs.push({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}

export default router;
export { orgStore, pendingEntities };
