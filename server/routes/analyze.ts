// API Routes for AI Layer Processing

import { Router } from 'express';
import { getOrchestrator } from '../layers/index.js';
import { TaskTimeEngine } from '../layers/task/TaskTimeEngine.js';
import { getStore, resetStore } from '../layers/task/store/InMemoryStore.js';
import { getAutomationLayer } from '../layers/automation/index.js';
import type { DecisionOutput } from '../layers/decision/types/decisionTypes.js';
import type { ReshufflePlan } from '../layers/task/types/scheduleTypes.js';

const router = Router();
const taskEngine = new TaskTimeEngine();

// POST /api/analyze - Full flow: Input -> Intent -> Decision -> TaskEngine
router.post('/analyze', async (req, res) => {
  try {
    const { text, source = 'text' } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Missing or invalid text parameter' 
      });
    }

    const orchestrator = getOrchestrator();
    const result = await orchestrator.processInput(text, source);
    
    // Apply decision to TaskTimeEngine (Internal-first)
    const processResult = taskEngine.apply(result.decision as DecisionOutput);

    // Trigger Automation Layer (external side effects)
    const automationLayer = getAutomationLayer();
    const actionPayload = result.decision.actionPlan?.payload || {};
    const automationResult = automationLayer.process(
      processResult.state,
      {
        actionType: result.decision.actionPlan?.actionType || 'none',
        entityId: typeof actionPayload.entityId === 'string' ? actionPayload.entityId : '',
        payload: actionPayload
      }
    );

    res.json({
      input: result.input,
      intent: result.intent,
      decision: result.decision,
      decomposition: result.decomposition,
      state: processResult.state,
      uiInstructions: {
        ...processResult.uiInstructions,
        automation: automationResult
      },
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error in /api/analyze:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/answer - Answer a question from Decision Engine
router.post('/answer', async (req, res) => {
  try {
    const { answer, questionId } = req.body;
    
    if (!answer || !questionId) {
      return res.status(400).json({ 
        error: 'Missing answer or questionId' 
      });
    }

    // Process the answer as new input with context
    const orchestrator = getOrchestrator();
    const result = await orchestrator.processInput(answer, 'text');
    
    // Apply to TaskTimeEngine (Internal-first)
    const processResult = taskEngine.apply(result.decision as DecisionOutput);

    // Trigger Automation Layer
    const automationLayer = getAutomationLayer();
    const answerActionPayload = result.decision.actionPlan?.payload || {};
    const automationResult = automationLayer.process(
      processResult.state,
      {
        actionType: result.decision.actionPlan?.actionType || 'none',
        entityId: typeof answerActionPayload.entityId === 'string' ? answerActionPayload.entityId : '',
        payload: answerActionPayload
      }
    );

    // Clear the question
    getStore().setLastQuestion(null);

    res.json({
      input: result.input,
      intent: result.intent,
      decision: result.decision,
      state: processResult.state,
      uiInstructions: {
        ...processResult.uiInstructions,
        automation: automationResult
      },
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('Error in /api/answer:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/action - Direct UI actions (mark_done, cancel, etc.)
router.post('/action', async (req, res) => {
  try {
    const { action, id, entityType, value } = req.body;
    
    if (!action) {
      return res.status(400).json({ 
        error: 'Missing action parameter' 
      });
    }

    let result;

    switch (action) {
      case 'mark_done':
        result = taskEngine.markDone(id);
        break;
      
      case 'cancel':
        result = taskEngine.apply({
          decision: 'execute',
          reason: 'Direct cancel action',
          confidence: 1,
          requiredNextLayer: 'none',
          actionPlan: {
            actionType: 'cancel',
            payload: { entityId: id, entityType },
            dependencies: [],
            constraints: [],
            mustLock: false,
            urgency: 'low'
          },
          question: { shouldAsk: false, questionId: '', text: '', expectedAnswerType: 'free_text', options: [] },
          reflection: { shouldReflect: false, text: '', microStep: '' }
        });
        break;
      
      case 'toggle_must_lock':
        result = taskEngine.toggleMustLock(id);
        break;
      
      case 'update_duration':
        result = taskEngine.updateDuration(id, value);
        break;
      
      case 'move_to_later':
        result = taskEngine.moveToLater(id);
        break;
      
      case 'confirm_plan':
        const store = getStore();
        const state = store.getState();
        // Get plans from last stored state or request body
        const plans = req.body.plans as ReshufflePlan[] | undefined;
        if (!plans) {
          return res.status(400).json({ error: 'Missing plans for confirmation' });
        }
        result = taskEngine.confirmPlan(value as 'A' | 'B', plans);
        break;
      
      case 'rebuild_schedule':
        result = taskEngine.rebuildSchedule(value);
        break;
      
      case 'reset':
        resetStore();
        result = {
          success: true,
          state: getStore().getState(),
          uiInstructions: {
            showQuestionModal: false,
            showReflectionCard: false,
            refreshTimeline: true,
            refreshTaskList: true,
            planOptions: null,
            message: 'המערכת אופסה',
            messageType: 'info' as const
          }
        };
        break;
      
      default:
        return res.status(400).json({ 
          error: `Unknown action: ${action}` 
        });
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /api/action:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/state - Get current state
router.get('/state', (req, res) => {
  try {
    const store = getStore();
    res.json({
      state: store.getState(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /api/state:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
