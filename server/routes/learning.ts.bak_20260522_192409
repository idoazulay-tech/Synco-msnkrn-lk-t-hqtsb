// Layer 5: Learning Engine API Routes

import { Router, Request, Response } from 'express';
import { LearningEngine, getLearningStore } from '../layers/learning/index.js';
import { prisma } from '../lib/prisma.js';
import { buildDailyLearningSummary } from '../services/learningSummaryService.js';
import { buildPlanningLearningContext } from '../services/planningLearningContextService.js';
import { buildDurationSuggestionContext } from '../services/durationIntelligenceService.js';
import { storeUserMessage } from '../brain/services/memory.js';

// ─── Synco Brain Memory ingestion helpers ────────────────────────────────────
// Only high-value, low-noise event types are mirrored to Qdrant.
// task_rescheduled, task_deleted, etc. are intentionally excluded to avoid
// noisy or misleading memory context.

function shouldIngestLearningEvent(eventType: string): boolean {
  return (
    eventType === 'task_created' ||
    eventType === 'task_completed' ||
    eventType === 'task_execution_completed'
  );
}

function buildMemoryTextFromLearningEvent(event: {
  eventType: string;
  taskTitleSnapshot: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const title = event.taskTitleSnapshot?.trim();
  if (!title) return '';

  if (event.eventType === 'task_created') {
    return `המשתמש יצר משימה חדשה: ${title}. זה עשוי להעיד על כוונה או צורך לתכנן פעולה.`;
  }

  if (event.eventType === 'task_completed') {
    return `המשתמש השלים משימה: ${title}. זהו סימן ביצוע בפועל.`;
  }

  if (event.eventType === 'task_execution_completed') {
    // Elapsed scheduled time is not actual execution duration.
    // Only timer-confirmed duration is eligible for duration memory.
    const meta        = event.metadata ?? {};
    const startSource = typeof meta.actualStartSource === 'string'
      ? meta.actualStartSource
      : 'unknown';
    const actualMins  = meta.actualDurationMinutes;
    const isConfirmed =
      startSource === 'execution_start' &&
      typeof actualMins === 'number' &&
      isFinite(actualMins) &&
      actualMins > 0;

    if (!isConfirmed) {
      // planned_fallback / expired / unknown — elapsed block is not actual duration.
      // task_completed already records the completion fact separately.
      return '';
    }

    return (
      `המשתמש סיים ביצוע של המשימה: ${title}. ` +
      `משך הביצוע בפועל שאושר באמצעות טיימר: ${actualMins} דקות.`
    );
  }

  return '';
}

const router = Router();

function getEngine(): LearningEngine {
  return new LearningEngine(getLearningStore());
}

// GET /api/learning - Get learning state
router.get('/', (_req: Request, res: Response) => {
  try {
    const store = getLearningStore();
    const state = store.getLearningState();
    
    res.json({
      success: true,
      data: {
        activeRules: store.getActiveRules(),
        pausedRules: store.getPausedRules(),
        pendingProposal: store.getPendingProposal(),
        recentDecisions: store.getRecentDecisionLogs(5),
        patterns: store.getPatterns().slice(0, 10),
        stats: {
          totalDecisions: state.decisionLogs.length,
          totalRules: state.preferenceRules.length,
          totalPatterns: state.patterns.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/learning/rule/confirm - Confirm pending rule proposal
router.post('/rule/confirm', (_req: Request, res: Response) => {
  try {
    const engine = getEngine();
    const rule = engine.confirmRuleProposal();
    
    if (rule) {
      res.json({
        success: true,
        data: {
          rule,
          message: 'הכלל נוצר בהצלחה'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'אין הצעת כלל פעילה'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/learning/rule/decline - Decline pending rule proposal
router.post('/rule/decline', (_req: Request, res: Response) => {
  try {
    const engine = getEngine();
    engine.declineRuleProposal();
    
    res.json({
      success: true,
      message: 'ההצעה נדחתה'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/learning/rule/toggle - Toggle rule status (pause/resume)
router.post('/rule/toggle', (req: Request, res: Response) => {
  try {
    const { ruleId, status } = req.body;
    
    if (!ruleId || !['active', 'paused'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'נדרש ruleId וסטטוס (active/paused)'
      });
      return;
    }
    
    const engine = getEngine();
    const rule = engine.toggleRule(ruleId, status);
    
    if (rule) {
      res.json({
        success: true,
        data: {
          rule,
          message: status === 'paused' ? 'הכלל הושהה' : 'הכלל הופעל מחדש'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'כלל לא נמצא'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/learning/process - Process a learning event (for integration)
router.post('/process', (req: Request, res: Response) => {
  try {
    const {
      actionType,
      comparedItems,
      userChoice,
      context,
      plannedMinutes,
      actualMinutes,
      feedback
    } = req.body;
    
    if (!actionType || !userChoice) {
      res.status(400).json({
        success: false,
        error: 'נדרש actionType ו-userChoice'
      });
      return;
    }
    
    const engine = getEngine();
    const result = engine.process(
      actionType,
      comparedItems || [],
      userChoice,
      context || {
        cognitiveLoad: 'medium',
        urgencyLevels: {},
        mustLocks: [],
        timeWindow: { startIso: '', endIso: '' },
        isReshuffle: false,
        isFollowUp: false
      },
      plannedMinutes || 0,
      actualMinutes,
      feedback
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ─── DB-backed Learning Events ────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = new Set([
  'task_created',
  'task_completed',
  'task_rescheduled',
  'task_deleted',
  'schedule_applied',
  'task_updated',
  'task_started',
  'task_execution_completed',
  'task_report_submitted',
  'task_start_blocker_logged',
  'task_postponed',
  'task_energy_check',
  'task_breakdown_requested',
]);

// POST /api/learning/events — save a learning event to PostgreSQL
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      taskId,
      eventType,
      source,
      dateIso,
      taskTitleSnapshot,
      fromStatus,
      toStatus,
      fromStartTime,
      toStartTime,
      fromEndTime,
      toEndTime,
      metadata,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (!eventType) {
      return res.status(400).json({ ok: false, error: 'eventType is required' });
    }
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({
        ok: false,
        error: `eventType must be one of: ${[...ALLOWED_EVENT_TYPES].join(', ')}`,
      });
    }

    const event = await prisma.learningEvent.create({
      data: {
        userId,
        taskId:            taskId            ?? null,
        eventType,
        source:            source            ?? null,
        dateIso:           dateIso           ?? null,
        taskTitleSnapshot: taskTitleSnapshot ?? null,
        fromStatus:        fromStatus        ?? null,
        toStatus:          toStatus          ?? null,
        fromStartTime:     fromStartTime     ? new Date(fromStartTime) : null,
        toStartTime:       toStartTime       ? new Date(toStartTime)   : null,
        fromEndTime:       fromEndTime       ? new Date(fromEndTime)   : null,
        toEndTime:         toEndTime         ? new Date(toEndTime)     : null,
        metadata:          metadata          ?? null,
      },
    });

    // ── Fire-and-forget: mirror high-value events into Qdrant ─────────────────
    // Runs after response is sent; never blocks or changes the API response.
    // Failures are logged as warnings only — Postgres save is already committed.
    if (shouldIngestLearningEvent(event.eventType)) {
      const memoryText = buildMemoryTextFromLearningEvent({
        eventType:         event.eventType,
        taskTitleSnapshot: event.taskTitleSnapshot,
        metadata:          event.metadata as Record<string, unknown> | null,
      });
      if (memoryText) {
        const isTimerConfirmed =
          event.eventType === 'task_execution_completed' &&
          (event.metadata as Record<string, unknown> | null)?.actualStartSource === 'execution_start';

        void storeUserMessage(event.userId, memoryText, {
          type:               event.eventType,
          source:             'learning_event',
          taskId:             event.taskId   ?? undefined,
          learningEventId:    event.id,
          dateIso:            event.dateIso  ?? undefined,
          status:             'active',
          importance:         event.eventType === 'task_completed' ? 'high' : 'medium',
          ...(isTimerConfirmed && {
            evidenceType:      'timer_confirmed',
            durationConfidence:'confirmed',
            integrityStatus:   'accepted_fact',
          }),
        }).catch((err: unknown) => {
          console.warn('[SyncoMemory] Failed to mirror learning event to Qdrant', {
            eventType: event.eventType,
            eventId:   event.id,
            message:   err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    res.json({
      ok: true,
      event: {
        id:         event.id,
        eventType:  event.eventType,
        taskId:     event.taskId,
        occurredAt: event.occurredAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('POST /api/learning/events error:', error);
    res.status(500).json({ ok: false, error: 'Failed to save learning event' });
  }
});

// GET /api/learning/planning-context?userId=default-user&date=YYYY-MM-DD — read-only, for testing
router.get('/planning-context', async (req: Request, res: Response) => {
  try {
    const userId  = req.query.userId as string | undefined;
    const dateIso = req.query.date  as string | undefined;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (!dateIso) {
      return res.status(400).json({ ok: false, error: 'date is required (YYYY-MM-DD)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return res.status(400).json({ ok: false, error: 'date must be in YYYY-MM-DD format' });
    }

    const context = await buildPlanningLearningContext(userId, dateIso);
    res.json({ ok: true, userId, date: dateIso, context });
  } catch (error: any) {
    console.error('GET /api/learning/planning-context error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build planning context' });
  }
});

// GET /api/learning/daily-summary?userId=default-user&date=YYYY-MM-DD
router.get('/daily-summary', async (req: Request, res: Response) => {
  try {
    const userId  = req.query.userId as string | undefined;
    const dateIso = req.query.date  as string | undefined;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (!dateIso) {
      return res.status(400).json({ ok: false, error: 'date is required (YYYY-MM-DD)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return res.status(400).json({ ok: false, error: 'date must be in YYYY-MM-DD format' });
    }

    const summary = await buildDailyLearningSummary(userId, dateIso);

    res.json({ ok: true, userId, date: dateIso, summary });
  } catch (error: any) {
    console.error('GET /api/learning/daily-summary error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build daily summary' });
  }
});

// POST /api/learning/duration-suggestions — Stage 3ד Duration Intelligence
router.post('/duration-suggestions', async (req: Request, res: Response) => {
  try {
    const { userId = 'default-user', dateIso, tasks = [] } = req.body;

    const context = await buildDurationSuggestionContext(userId, tasks, {
      lookbackDays: 14,
      dateIso,
    });

    res.json({ ok: true, context });
  } catch (error: any) {
    console.error('POST /api/learning/duration-suggestions error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build duration suggestions' });
  }
});

// GET /api/learning/duration-suggestions — Stage 3ד (query-string version, tasks=[])
router.get('/duration-suggestions', async (req: Request, res: Response) => {
  try {
    const userId  = (req.query.userId as string) || 'default-user';
    const dateIso = req.query.date as string | undefined;

    const context = await buildDurationSuggestionContext(userId, [], { lookbackDays: 14, dateIso });
    res.json({ ok: true, context });
  } catch (error: any) {
    console.error('GET /api/learning/duration-suggestions error:', error);
    res.status(500).json({ ok: false, error: 'Failed to build duration suggestions' });
  }
});

// GET /api/learning/events?userId=default-user&limit=50 — for inspection only
router.get('/events', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const limit  = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);

    const events = await prisma.learningEvent.findMany({
      where:   { userId },
      orderBy: { occurredAt: 'desc' },
      take:    limit,
    });

    res.json({
      ok: true,
      count: events.length,
      events: events.map(e => ({
        id:                e.id,
        eventType:         e.eventType,
        taskId:            e.taskId,
        source:            e.source,
        occurredAt:        e.occurredAt.toISOString(),
        dateIso:           e.dateIso,
        taskTitleSnapshot: e.taskTitleSnapshot,
        fromStatus:        e.fromStatus,
        toStatus:          e.toStatus,
        fromStartTime:     e.fromStartTime?.toISOString() ?? null,
        toStartTime:       e.toStartTime?.toISOString()   ?? null,
        fromEndTime:       e.fromEndTime?.toISOString()   ?? null,
        toEndTime:         e.toEndTime?.toISOString()     ?? null,
        metadata:          e.metadata,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/learning/events error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch learning events' });
  }
});

export default router;
