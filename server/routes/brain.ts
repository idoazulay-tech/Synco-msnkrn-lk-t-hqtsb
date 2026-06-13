import { Router } from 'express';
import { processBrainInput, answerCuriosity, getBrainStatus, handleApproval } from '../brain/index.js';
import { createRawEvent }                   from '../brain/types/rawEvent.js';
import { runContinuousBrainFoundation }     from '../brain/services/continuousBrainPipeline.js';
import { saveRawEvent, updateRawEventStatus } from '../brain/services/rawEventStore.js';
import { persistFromRoutingPlan }           from '../brain/services/persistFromRoutingPlan.js';
import { retrieveContinuousBrainContext }   from '../brain/services/brainContextRetrieval.js';
import { t }                                from '../brain/localization/index.js';

const router = Router();

router.post('/process', async (req, res) => {
  try {
    const { userId, text, type, payload } = req.body;

    if (!userId || !text) {
      return res.status(400).json({ error: 'userId and text are required' });
    }

    const result = await processBrainInput(userId, text, type, payload);
    res.json(result);
  } catch (error: any) {
    console.error('Brain process error:', error);
    res.status(500).json({ error: 'Failed to process brain input', details: error.message });
  }
});

router.post('/approve', async (req, res) => {
  try {
    const { userId, approved } = req.body;

    if (!userId || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'userId and approved (boolean) are required' });
    }

    await handleApproval(userId, approved);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Brain approval error:', error);
    res.status(500).json({ error: 'Failed to process approval', details: error.message });
  }
});

router.post('/curiosity/answer', async (req, res) => {
  try {
    const { userId, questionId, answer } = req.body;

    if (!userId || !questionId || !answer) {
      return res.status(400).json({ error: 'userId, questionId, and answer are required' });
    }

    const result = await answerCuriosity(userId, questionId, answer);
    res.json(result);
  } catch (error: any) {
    console.error('Curiosity answer error:', error);
    res.status(500).json({ error: 'Failed to process curiosity answer', details: error.message });
  }
});

router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const status = await getBrainStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error('Brain status error:', error);
    res.status(500).json({ error: 'Failed to get brain status', details: error.message });
  }
});

// ─── POST /api/brain/share ────────────────────────────────────────────────────
// Accepts shared/pasted text, runs Continuous Brain, persists if requested.

router.post('/share', async (req, res) => {
  try {
    const {
      userId,
      text,
      sourceName    = 'share',
      contentType   = 'text',
      languageHint,
      persist       = false,
      devMode       = false,
    } = req.body as {
      userId:       string;
      text:         string;
      sourceName?:  string;
      contentType?: 'text' | 'article' | 'message' | 'note' | 'transcript';
      languageHint?: 'he' | 'en';
      persist?:     boolean;
      devMode?:     boolean;
    };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ ok: false, message: t.share.validationError });
    }
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ ok: false, message: t.share.validationError });
    }

    // ── Build RawEvent ────────────────────────────────────────────────────────
    const rawEvent = createRawEvent(userId, text.trim(), 'shared_text', {
      sourceName,
      contentType: contentType === 'text' ? 'text' : 'text', // all map to text for now
      metadata: {
        characterCount: text.length,
        languageHint:   languageHint ?? (text.match(/[א-ת]/) ? 'he' : 'en'),
      },
    });

    // ── Run Continuous Brain Pipeline ─────────────────────────────────────────
    const brainResult = runContinuousBrainFoundation({
      userId,
      rawEvent,
    });

    if (!brainResult.ok && !brainResult.signals.length) {
      return res.status(500).json({
        ok:      false,
        message: t.share.unexpectedError,
      });
    }

    // ── Persist if requested ──────────────────────────────────────────────────
    let rawEventDbId: string | undefined;
    let persistResult: Awaited<ReturnType<typeof persistFromRoutingPlan>> | undefined;

    const persisted = {
      rawEvent:        false,
      signalsCount:    0,
      wikiUpdatesCount: 0,
      graphNodesCount: 0,
      graphEdgesCount: 0,
      openQuestionsCount: 0,
    };

    if (persist) {
      // 1. Save RawEvent
      const saveResult = await saveRawEvent(rawEvent);
      if (saveResult.ok && saveResult.id) {
        rawEventDbId = saveResult.id;
        persisted.rawEvent = true;
        await updateRawEventStatus(rawEventDbId, 'processing');
      } else {
        console.warn('[brain/share] RawEvent save failed:', saveResult.error);
      }

      // 2. Persist signals + wiki + graph + open questions
      persistResult = await persistFromRoutingPlan({
        userId,
        rawEventDbId,
        rawInputText:         text,
        signals:              brainResult.signals,
        openQuestions:        brainResult.openQuestions,
        wikiUpdateCandidates: brainResult.wikiUpdateCandidates,
        graphUpdateCandidates: brainResult.graphUpdateCandidates,
      });

      persisted.signalsCount     = persistResult.persistedCounts.signals;
      persisted.wikiUpdatesCount = persistResult.persistedCounts.wikiUpdates;
      persisted.graphNodesCount  = persistResult.persistedCounts.graphNodes;
      persisted.graphEdgesCount  = persistResult.persistedCounts.graphEdges;
      persisted.openQuestionsCount = persistResult.persistedCounts.openQuestions;

      if (rawEventDbId) {
        await updateRawEventStatus(rawEventDbId, persistResult.partialFailure ? 'failed' : 'processed');
      }
    }

    // ── Build Hebrew summary ──────────────────────────────────────────────────
    const signalCount = brainResult.signals.length;
    const hasSignals  = signalCount > 0;
    let messageParts: string[] = [];

    if (persist) {
      messageParts.push(t.share.successPersisted);
    } else {
      messageParts.push(t.share.successDryRun);
    }
    if (hasSignals) {
      messageParts.push(t.share.signalsSummary(signalCount));
    } else {
      messageParts.push(t.share.noSignals);
    }
    if (persist && persisted.wikiUpdatesCount > 0) {
      messageParts.push(t.share.wikiSummary(persisted.wikiUpdatesCount));
    }
    if (persist && (persisted.graphNodesCount > 0 || persisted.graphEdgesCount > 0)) {
      messageParts.push(t.share.graphSummary(persisted.graphNodesCount, persisted.graphEdgesCount));
    }
    if (brainResult.openQuestions.length > 0) {
      messageParts.push(t.share.openQSummary(brainResult.openQuestions.length));
    }
    if (persistResult?.partialFailure) {
      messageParts = [t.share.partialFailure];
    }

    const message = messageParts.join(' ');

    // ── Response ──────────────────────────────────────────────────────────────
    const response: Record<string, unknown> = {
      ok:          true,
      message,
      rawEventId:  rawEventDbId,
      signals:     brainResult.signals.map(s => ({
        signalType:         s.signalType,
        title:              s.title,
        summary:            s.summary,
        confidence:         s.confidence,
        shouldCreateTask:   s.shouldCreateTask,
        shouldUpdateWiki:   s.shouldUpdateWiki,
        shouldUpdateGraph:  s.shouldUpdateGraph,
      })),
      suggestedTasks:        brainResult.suggestedTasks,
      openQuestions:         brainResult.openQuestions.map(q => ({
        questionText:       q.questionText,
        questionType:       q.questionType,
        relatedEntityName:  q.relatedEntityName,
      })),
      wikiUpdateCandidates:  brainResult.wikiUpdateCandidates,
      graphUpdateCandidates: brainResult.graphUpdateCandidates.map(g => ({
        nodesToCreate: g.nodesToCreate,
        edgesToCreate: g.edgesToCreate,
        diagnostics:   g.diagnostics,
      })),
      persisted,
    };

    if (devMode) {
      response.diagnostics = {
        brain:   brainResult.diagnostics,
        persist: persistResult?.diagnostics ?? ['persist=false — no persistence diagnostics'],
      };
    }

    return res.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[brain/share] unexpected error:', msg);
    return res.status(500).json({ ok: false, message: t.share.unexpectedError });
  }
});

// ─── GET /api/brain/share/status/:userId ─────────────────────────────────────

router.get('/share/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { listRecentRawEventsForUser } = await import('../brain/services/rawEventStore.js');
    const result = await listRecentRawEventsForUser(userId, 10);
    if (!result.ok) {
      return res.status(500).json({ ok: false, message: t.share.unexpectedError });
    }
    return res.json({
      ok:         true,
      totalEvents: result.events.length,
      recentEvents: result.events.map(e => ({
        id:              e.id,
        sourceType:      e.sourceType,
        processingStatus: e.processingStatus,
        capturedAt:      e.capturedAt,
        sensitivityLevel: e.sensitivityLevel,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[brain/share/status] error:', msg);
    return res.status(500).json({ ok: false, message: t.share.unexpectedError });
  }
});

// ─── GET /api/brain/retrieve ──────────────────────────────────────────────────
// Query the Continuous Brain knowledge store.
// ?userId=...&query=...&devMode=true

router.get('/retrieve', async (req, res) => {
  try {
    const { userId, query, devMode } = req.query as Record<string, string>;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ ok: false, message: t.retrieve.validationError });
    }
    if (!query || !query.trim()) {
      return res.status(400).json({ ok: false, message: t.retrieve.validationError });
    }

    const result = await retrieveContinuousBrainContext(userId.trim(), query.trim());

    const response: Record<string, unknown> = {
      ok:          result.ok || result.sources.length > 0,
      message:     result.summary,
      query:       result.query,
      sources:     result.sources,
      wikiEntries: result.wikiEntries.map(w => ({
        topic:       w.topic,
        summary:     w.summary,
        keyPoints:   w.keyPoints,
        confidence:  w.confidence,
        updatedAt:   w.updatedAt,
      })),
      signals: result.signals.map(s => ({
        signalType:  s.signalType,
        title:       s.title,
        summary:     s.summary,
        confidence:  s.confidence,
        createdAt:   s.createdAt,
      })),
      graphNodes: result.graphNodes.map(n => ({
        nodeType:   n.nodeType,
        label:      n.label,
        confidence: n.confidence,
      })),
      graphContext: result.graphContext ? {
        nodeLabel:       result.graphContext.node?.label,
        nodeType:        result.graphContext.node?.nodeType,
        connectedLabels: result.graphContext.connectedLabels,
        edgeCount:       result.graphContext.allEdges.length,
        edges:           result.graphContext.allEdges.map(e => ({
          direction:    e.direction,
          relationType: e.relationType,
          otherLabel:   e.otherNodeLabel,
          otherType:    e.otherNodeType,
          confidence:   e.confidence,
        })),
      } : null,
    };

    if (devMode === 'true') {
      response.diagnostics = result.diagnostics;
    }

    return res.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[brain/retrieve] unexpected error:', msg);
    return res.status(500).json({ ok: false, message: t.retrieve.unexpectedError });
  }
});

export default router;
