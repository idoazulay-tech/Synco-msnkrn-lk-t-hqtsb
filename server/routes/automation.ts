// Layer 6: Automation Layer - API Routes

import { Router, Request, Response } from 'express';
import { getAutomationStore } from '../layers/automation/store/AutomationStore.js';
import { getAutomationLayer } from '../layers/automation/AutomationLayer.js';
import { getJob, updateJobStatus } from '../layers/automation/queue/jobQueue.js';

const router = Router();

// GET /api/integrations - Get integration statuses
router.get('/integrations', (_req: Request, res: Response) => {
  const store = getAutomationStore();
  const integrations = store.getIntegrations();
  
  res.json({
    integrations: {
      mock: {
        name: 'Mock Connector',
        status: integrations.mock.status,
        accountEmail: integrations.mock.accountEmail
      },
      googleCalendar: {
        name: 'Google Calendar',
        status: integrations.googleCalendar.status,
        accountEmail: integrations.googleCalendar.accountEmail
      }
    }
  });
});

// POST /api/integrations/connect - Connect an integration
router.post('/integrations/connect', (req: Request, res: Response) => {
  const { provider, email } = req.body;
  
  if (!provider || !['mock', 'googleCalendar'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }
  
  const store = getAutomationStore();
  
  if (provider === 'googleCalendar') {
    // TODO: Implement OAuth flow
    // For now, return needs_user_action
    return res.json({
      success: false,
      status: 'needs_user_action',
      message: 'Google Calendar OAuth not yet implemented. Please check back later.',
      oauthUrl: null // TODO: Return OAuth URL when implemented
    });
  }
  
  // Mock provider can be connected directly
  store.setIntegrationStatus(provider, 'connected', email || 'mock@example.com');
  
  res.json({
    success: true,
    status: 'connected',
    message: `${provider} connected successfully`
  });
});

// POST /api/integrations/disconnect - Disconnect an integration
router.post('/integrations/disconnect', (req: Request, res: Response) => {
  const { provider } = req.body;
  
  if (!provider || !['mock', 'googleCalendar'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }
  
  const store = getAutomationStore();
  store.setIntegrationStatus(provider, 'disconnected');
  
  res.json({
    success: true,
    status: 'disconnected',
    message: `${provider} disconnected`
  });
});

// GET /api/automation/jobs - Get recent jobs
router.get('/automation/jobs', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const automationLayer = getAutomationLayer();
  const jobs = automationLayer.getRecentJobs(limit);
  
  res.json({ jobs });
});

// GET /api/automation/audit - Get audit log
router.get('/automation/audit', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const store = getAutomationStore();
  const entries = store.getRecentAuditEntries(limit);
  
  res.json({ entries });
});

// POST /api/automation/retry/:jobId - Retry a failed job
router.post('/automation/retry/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== 'failed' && job.status !== 'needs_user_action') {
    return res.status(400).json({ 
      error: 'Can only retry failed or needs_user_action jobs' 
    });
  }
  
  const updatedJob = updateJobStatus(jobId, 'queued', {
    attempts: 0,
    lastError: null,
    nextRetryAtIso: null
  });
  
  res.json({
    success: true,
    job: updatedJob
  });
});

// GET /api/automation/state - Get full automation state
router.get('/automation/state', (_req: Request, res: Response) => {
  const store = getAutomationStore();
  const automationLayer = getAutomationLayer();
  
  res.json({
    integrations: store.getIntegrations(),
    recentJobs: automationLayer.getRecentJobs(10),
    recentAudit: store.getRecentAuditEntries(10),
    lastErrors: store.getLastErrors(),
    workerRunning: automationLayer.isWorkerRunning(),
    uiInstructions: automationLayer.getUIInstructions()
  });
});

export default router;
