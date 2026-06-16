# Synco Brain — Architecture Inventory
**Generated:** 2026-06-13  
**Scope:** `server/brain/` + brain-consuming routes

---

## 1. Every Brain Module Currently Implemented

### 1.1 Three Parallel Brain Systems

Synco contains **three independent brain systems** that share the `OpenQuestion` table but otherwise run separately.

| System | Entry Point | Route | AI? | DB writes |
|--------|-------------|-------|-----|-----------|
| **A — Original Brain** | `brain/index.ts → processBrainInput()` | `POST /api/brain/process` | Yes (OpenAI) | Qdrant + UserMetrics + BrainFlag + OpenQuestion |
| **B — Quick Pipeline** | `brainPipeline.ts → runBrainPipeline()` | `POST /quick` (fire-and-forget) | No | OpenQuestion |
| **C — Continuous Brain** | `continuousBrainPipeline.ts → runContinuousBrainFoundation()` | `POST /api/brain/share` | No | RawCaptureEvent + BrainSignal + WikiEntry + GraphNode + GraphEdge + OpenQuestion |

---

### 1.2 Module Catalog (48 files)

#### Types (7 files)
| File | Purpose | System |
|------|---------|--------|
| `types/index.ts` | BrainResponse, BrainContext, BrainEvent, CuriosityItem, BrainInsight | A |
| `types/rawEvent.ts` | RawEvent interface + `createRawEvent()` factory | C |
| `types/privacy.ts` | PrivacyMetadata, `defaultPrivacy()`, `sensitivePrivacy()`, `sessionOnlyPrivacy()` | C |
| `types/signal.ts` | Signal interface, SignalType enum, `createSignal()` factory | C |
| `types/personalWiki.ts` | PersonalWikiEntry, WikiUpdateCandidate | C |
| `types/knowledgeGraph.ts` | GraphNode, GraphEdge, GraphUpdateCandidate, NodeToCreate, EdgeToCreate | C |
| `types/knowledgeGraph.ts` | RoutedMemoryPlan, RoutedMemory | C |

#### System A — Original Brain Services (6 files)
| File | Purpose | I/O |
|------|---------|-----|
| `ingestion.ts` | RawInput type, `createTextForEmbedding()` | Pure |
| `memory.ts` | Qdrant: store/search events, insights, profile, knowledge | Qdrant (fallback-safe) |
| `localAnalyzer.ts` | Rule-based flags (MISSING_INFO, REPEATED_POSTPONE, etc.), AI cooldown gate | Postgres: UserMetrics, BrainFlag |
| `aiAnalyzer.ts` | OpenAI: flag analysis → insight or question | OpenAI |
| `understanding.ts` | OpenAI: full context understanding → actions, insights, curiosity | OpenAI |
| `policy.ts` | In-memory trust levels + Qdrant learning state | In-memory Map + Qdrant |
| `curiosity.ts` | In-memory curiosity question queue, scheduling | In-memory Map only |

#### System B — Quick Pipeline Services (12 files)
| File | Purpose | I/O |
|------|---------|-----|
| `memoryLoader.ts` | Loads LearningEvent rows → SyncoMemory[], with burst-collapse | Postgres: LearningEvent |
| `lifeRuleLoader.ts` | Loads LifeRule rows → LifeRule[] | Postgres: LifeRule |
| `syncoThinkingLayer.ts` | detectPatterns, createCausalHypotheses, predictRisks, proposeExperiments, runSyncoThinkingLayer | Pure |
| `rescheduleBurstDetector.ts` | Detects rapid reschedule bursts within time window | Pure |
| `rescheduleBurstCollapse.ts` | Collapses burst sequences into single SyncoMemory | Pure |
| `settledRescheduleDeriver.ts` | Planned Qdrant write of settled reschedule facts | Pure (unused) |
| `patternDecay.ts` | Exponential confidence decay over time + evidence guard | Pure |
| `recentTrendAnalyzer.ts` | RECENT_WINDOW_DAYS=14, contradiction penalty 0.5×, trend override | Pure |
| `patternExplainability.ts` | Human-readable Hebrew explanation for each pattern | Pure |
| `brainRecommendation.ts` | Hebrew user-facing recommendation from patterns + life rules | Pure |
| `inputContextAnalyzer.ts` | Extracts intent, entities, urgency, missing info from text | Pure |
| `decisionSupport.ts` | Evaluates decision against patterns, life rules, predictions | Pure |

#### System C — Continuous Brain Services (12 files)
| File | Purpose | I/O |
|------|---------|-----|
| `meaningEngine.ts` | Hebrew heuristics → Signal[], openQuestions, wikiHints, graphHints | Pure |
| `memoryRouter.ts` | Signal[] → RoutedMemoryPlan (5 memory types + wiki + graph) | Pure |
| `continuousBrainPipeline.ts` | Orchestrates MeaningEngine → MemoryRouter | Pure |
| `rawEventStore.ts` | save/get/list RawCaptureEvent | Postgres |
| `signalStore.ts` | save/list BrainSignal (per user or per raw event) | Postgres |
| `personalWikiStore.ts` | upsert WikiEntry with keyPoint dedup + confidence blending | Postgres |
| `knowledgeGraphStore.ts` | upsert GraphNode + GraphEdge with confidence boost | Postgres |
| `persistFromRoutingPlan.ts` | Bridge: routes pipeline result to all 4 stores + OpenQuestion | Postgres (all C tables) |
| `wikiRetrieval.ts` | searchWikiByTopic (exact→fuzzy), searchWikiByText | Postgres |
| `signalRetrieval.ts` | searchSignalsByType/Text/Entity, getSignalsForQuery (merged) | Postgres + raw SQL |
| `graphRetrieval.ts` | findGraphNodes by label/type, getGraphContextForNode (edges in+out) | Postgres |
| `brainContextRetrieval.ts` | retrieveContinuousBrainContext: parallel wiki+signal+graph search | Postgres |

#### Shared Services (3 files)
| File | Purpose | I/O |
|------|---------|-----|
| `openQuestions.ts` | persistDeferredQuestions (dedup), answerOpenQuestion, listOpenQuestions | Postgres: OpenQuestion |
| `learningMemoryDerivation.ts` | Derives factual Qdrant memories from LearningEvent rows | Qdrant (via learning.ts) |
| `learningIntegrityGate.ts` | Contextual duplicate gate before Qdrant writes | Qdrant (via learning.ts) |

#### Localization (3 files)
| File | Purpose |
|------|---------|
| `localization/he.ts` | All user-facing Hebrew strings (primary language) |
| `localization/en.ts` | English skeleton (not complete) |
| `localization/index.ts` | `getMessages()` + `t` shorthand |

#### Diagnostics / Utils (3 files)
| File | Purpose | Status |
|------|---------|--------|
| `diagnostics/brainDiagnostics.ts` | Full diagnostic report builder | Never called (see §11) |
| `evidenceScoring.ts` | Evidence source quality scoring | Only used by brainDiagnostics (see §11) |
| `utils/openai-client.ts` | `chatCompletion()`, `generateEmbedding()`, `isUsingFallbackEmbeddings()` | Active |

---

## 2. Data Flow Between Modules

### System A — Original Brain
```
POST /api/brain/process
  → updateLearningState (policy.ts)
  → storeUserMessage (memory.ts → Qdrant)
  → searchUserMemory (memory.ts → Qdrant)
  → analyzeEventLocal (localAnalyzer.ts → Postgres: UserMetrics, BrainFlag)
      ↓ if shouldTriggerAI = false
      → buildFlagResponse() → return early
      ↓ if shouldTriggerAI = true
  → runAIAnalysis (aiAnalyzer.ts → OpenAI)
  → buildContext (memory.ts → Qdrant)
  → analyzeWithContext (understanding.ts → OpenAI)
  → evaluatePolicy (policy.ts → in-memory + Qdrant)
  → storeInsight (memory.ts → Qdrant)
  → scheduleCuriosityQuestions (curiosity.ts → in-memory)
  → persistDeferredQuestions (openQuestions.ts → Postgres: OpenQuestion)
  → return BrainResponse
```

### System B — Quick Pipeline
```
POST /quick
  → interpretInput (ruleEngine.ts)
  → prisma.userTask.create()
  [fire-and-forget, non-blocking]:
  → loadBrainMemoriesForUser (memoryLoader.ts → Postgres: LearningEvent)
      → collapseRescheduleBursts (rescheduleBurstCollapse.ts → pure)
  → loadLifeRulesForUser (lifeRuleLoader.ts → Postgres: LifeRule)
  → retrieveContinuousBrainContext (brainContextRetrieval.ts → Postgres) [Phase 11]
  → checkKnownEntities (knownEntityChecker.ts → Postgres) [Phase 11]
  → runBrainPipeline (brainPipeline.ts):
      → analyzeInputContext (inputContextAnalyzer.ts → pure)
      → generateOpenQuestionsFromContext (inputContextAnalyzer.ts → pure)
      → filter known-entity questions [Phase 11]
      → persistDeferredQuestions (openQuestions.ts → Postgres: OpenQuestion)
      → runSyncoThinkingLayer (syncoThinkingLayer.ts → pure)
      → evaluateDecision (decisionSupport.ts → pure)
      → generateRecommendation (brainRecommendation.ts → pure)
  → return BrainPipelineResult (attached to quick response in devMode)
```

### System C — Continuous Brain
```
POST /api/brain/share
  → createRawEvent (types/rawEvent.ts → pure)
  → runContinuousBrainFoundation (continuousBrainPipeline.ts):
      → runMeaningEngine (meaningEngine.ts → pure)
      → routeSignalsToMemory (memoryRouter.ts → pure)
  [if persist=true]:
  → saveRawEvent (rawEventStore.ts → Postgres: RawCaptureEvent)
  → persistFromRoutingPlan (persistFromRoutingPlan.ts):
      → saveSignals → Postgres: BrainSignal
      → persistDeferredQuestions → Postgres: OpenQuestion
      → upsertWikiUpdateCandidates → Postgres: WikiEntry
      → upsertGraphUpdateCandidates → Postgres: GraphNode, GraphEdge
  → return Hebrew summary + signals + openQuestions + persisted counts

GET /api/brain/retrieve
  → retrieveContinuousBrainContext (brainContextRetrieval.ts):
      [parallel]: wiki + signal + graph node searches
      [sequential]: getGraphContextForNode
  → return Hebrew summary + all results + diagnostics
```

---

## 3. DB Tables Used by Each Module

### Postgres Tables

| Table | Module(s) that write | Module(s) that read |
|-------|---------------------|---------------------|
| `UserTask` | `quick.ts` | `quick.ts`, `user-tasks.ts` |
| `LearningEvent` | `learning.ts` | `memoryLoader.ts` |
| `LifeRule` | UI/settings | `lifeRuleLoader.ts` |
| `UserMetrics` | `localAnalyzer.ts` | `localAnalyzer.ts` |
| `BrainFlag` | `localAnalyzer.ts` | `localAnalyzer.ts` |
| `OpenQuestion` | `openQuestions.ts` (via 3 callers) | `openQuestions.ts`, route |
| `RawCaptureEvent` | `rawEventStore.ts` | `rawEventStore.ts` |
| `BrainSignal` | `signalStore.ts` | `signalStore.ts`, `signalRetrieval.ts` |
| `WikiEntry` | `personalWikiStore.ts` | `personalWikiStore.ts`, `wikiRetrieval.ts` |
| `GraphNode` | `knowledgeGraphStore.ts` | `knowledgeGraphStore.ts`, `graphRetrieval.ts`, `knownEntityChecker.ts` |
| `GraphEdge` | `knowledgeGraphStore.ts` | `knowledgeGraphStore.ts`, `graphRetrieval.ts` |

### Unused in Postgres Schema
| Table | Status |
|-------|--------|
| `InsightLog` | Defined in schema, never written to meaningfully. |
| `TaskFile`, `TaskRun`, `RunStep` | Early task-runner schema — not used by current UserTask flow. |

### Qdrant Collections (not yet connected in production)
| Collection | Owner | Status |
|-----------|-------|--------|
| `user_events` | `memory.ts` | Falls back silently if Qdrant absent |
| `user_insights` | `memory.ts` | Falls back silently |
| `user_profile` | `memory.ts` | Falls back silently |
| `synco_knowledge` | `memory.ts` | Falls back silently |

---

## 4. Routes That Use Each Module

| Route | Brain modules used |
|-------|-------------------|
| `POST /quick` | `brainPipeline`, `memoryLoader`, `lifeRuleLoader`, `syncoThinkingLayer`, `inputContextAnalyzer`, `decisionSupport`, `brainRecommendation`, `patternDecay`, `recentTrendAnalyzer`, `patternExplainability`, `rescheduleBurstCollapse`, `openQuestions`, `brainContextRetrieval` [P11], `knownEntityChecker` [P11] |
| `POST /api/brain/process` | `brain/index.ts`, `memory`, `localAnalyzer`, `aiAnalyzer`, `understanding`, `policy`, `curiosity`, `openQuestions` |
| `POST /api/brain/share` | `continuousBrainPipeline`, `meaningEngine`, `memoryRouter`, `rawEventStore`, `signalStore`, `personalWikiStore`, `knowledgeGraphStore`, `persistFromRoutingPlan`, `openQuestions`, `localization/he` |
| `GET /api/brain/retrieve` | `brainContextRetrieval`, `wikiRetrieval`, `signalRetrieval`, `graphRetrieval`, `localization/he` |
| `POST /api/learning` | `memory`, `learningMemoryDerivation`, `learningIntegrityGate`, `rescheduleBurstDetector` |

---

## 5. What Is Production-Ready

| Module | Evidence |
|--------|----------|
| `openQuestions.ts` | Dedup logic, used by 3 call sites, has DB constraints |
| `memoryLoader.ts` | Reads LearningEvent, burst-collapse, fail-open |
| `lifeRuleLoader.ts` | Pure mapping + fail-open loader |
| `runBrainPipeline()` (System B) | Used by every task creation via /quick |
| `syncoThinkingLayer` functions | Pure, 50+ passing tests |
| `patternDecay`, `recentTrendAnalyzer`, `patternExplainability` | Pure, tested |
| `brainRecommendation.ts` | Hebrew output, used by /quick |
| `inputContextAnalyzer.ts` | Pure, produces open questions in production |
| `knownEntityChecker.ts` | Phase 11 — fail-open, fire-and-forget |
| `localization/he.ts` | Covers share + retrieve + recommendation messages |

---

## 6. What Is Experimental

| Module | Reason |
|--------|--------|
| **System A (`brain/index.ts`)** | Requires OpenAI + Qdrant. Both may be unavailable. |
| `aiAnalyzer.ts` | OpenAI-dependent, gated behind cooldown. No tests. |
| `understanding.ts` | OpenAI-dependent. No tests. Prompt is hardcoded. |
| `curiosity.ts` | In-memory only — lost on server restart. |
| `policy.ts` | In-memory Map + Qdrant for trust levels. State lost on restart. |
| **System C (`/api/brain/share`, `/api/brain/retrieve`)** | Built and tested, but not yet the primary product flow. |

---

## 7. What Is Persisted

### Persisted to Postgres (durable)
| Data | Table |
|------|-------|
| Task events | `LearningEvent` |
| User tasks | `UserTask` |
| Open questions | `OpenQuestion` |
| Life rules | `LifeRule` |
| Raw capture events | `RawCaptureEvent` |
| Brain signals | `BrainSignal` |
| Wiki entries | `WikiEntry` |
| Graph nodes + edges | `GraphNode`, `GraphEdge` |

### In-memory only (lost on restart)
| Data | Location |
|------|----------|
| Curiosity question queue | `curiosity.ts: curiosityQueues Map` |
| Trust level / learning state | `policy.ts: userStates Map` |

---

## 8. What Is Retrieval-Only

| Module | Reads from |
|--------|-----------|
| `wikiRetrieval.ts` | `WikiEntry` |
| `signalRetrieval.ts` | `BrainSignal` |
| `graphRetrieval.ts` | `GraphNode`, `GraphEdge` |
| `brainContextRetrieval.ts` | All three above |
| `memoryLoader.ts` | `LearningEvent` |
| `lifeRuleLoader.ts` | `LifeRule` |
| `knownEntityChecker.ts` | `GraphNode`, `WikiEntry` |

---

## 9. What Is Still Planned

- **Open question answer → wiki update**: When user answers "מי זה דני?" → update WikiEntry + GraphNode
- **Graph visualization UI**: Data exists but no frontend renders it
- **Wiki viewer UI**: Data exists but no page shows it
- **Episodic/behavioral/knowledge/preference/commitment memory persistence**: MemoryRouter plans these but `persistFromRoutingPlan` logs them as `planned_only`
- **Qdrant connection for production**: Client initialized from env vars; falls back silently if not set
- **Semantic retrieval**: ILIKE only now — no vector/semantic search yet
- **Cross-signal temporal analysis**: Time-aware pattern detection in System C
- **Confidence decay in WikiEntry**: Entries grow stale over time — no decay yet

---

## 10. Current Technical Debt

| # | Debt | File(s) |
|---|------|---------|
| TD-1 | Duplicate Hebrew person extraction logic | `meaningEngine.ts` + `inputContextAnalyzer.ts` |
| TD-2 | `curiosity.ts` has no persistence — lost on restart | `curiosity.ts` |
| TD-3 | `policy.ts` trust state is unreliable after restart | `policy.ts` |
| TD-4 | System A and System B share zero state | `brain/index.ts`, `brainPipeline.ts` |
| TD-5 | `syncoThinkingLayer.ts` mixes types + logic | `syncoThinkingLayer.ts` |
| TD-6 | `OpenQuestion` has 3 callers with free-form `sourceInputRoute` strings | `openQuestions.ts` |
| TD-7 | `persistedCounts.graphNodes` counts created + updated as one number | `persistFromRoutingPlan.ts` |
| TD-8 | MeaningEngine financial_signal always creates one node `"הקשר פיננסי"` | `meaningEngine.ts` |
| TD-9 | Two `.bak` files committed to repo | `server/routes/learning.ts.bak_*` |

---

## 11. Current Unused Modules

| Module | Reason |
|--------|--------|
| `settledRescheduleDeriver.ts` | Never imported anywhere |
| `diagnostics/brainDiagnostics.ts` | Never imported — diagnostics built inline in brainPipeline |
| `evidenceScoring.ts` | Only imported by brainDiagnostics which is unused |
| `InsightLog` (Prisma model) | Never written to from application code |
| `TaskFile`, `TaskRun`, `RunStep` (Prisma models) | Not used by current UserTask flow |

---

## 12. Current Duplicate Logic

| Logic | Duplicated in |
|-------|--------------|
| Hebrew person extraction (regex) | `meaningEngine.ts` + `inputContextAnalyzer.ts` |
| `mergeSignalIds(existing, incoming)` | `personalWikiStore.ts` + `knowledgeGraphStore.ts` |
| Confidence clamping `Math.max(0, Math.min(1, ...))` | `patternDecay.ts`, `knowledgeGraphStore.ts`, `syncoThinkingLayer.ts` |

---

## 13. Recommended Next Phases in Order

| Phase | Title | Goal |
|-------|-------|------|
| **12** | Open Question Answer → Knowledge Update | When user answers "מי זה דני?" → update WikiEntry + GraphNode |
| **13** | Personal Wiki + Graph UI | `/wiki` and `/graph` pages to show stored knowledge |
| **14** | Episodic/Behavioral Memory Persistence | Persist the 5 planned memory types from MemoryRouter |
| **15** | Consolidate Person Extraction (TD-1) | Single `hebrewEntityExtractor.ts` utility |
| **16** | Fix In-Memory State (TD-2, TD-3) | Persist curiosity queue + trust level to Postgres |
| **17** | Remove Unused Modules (§11) | Delete dead code + orphan Prisma models |
| **18** | Semantic Retrieval (Qdrant + System C) | Vector search as fallback after ILIKE finds nothing |

---

*End of inventory. Total brain modules: 48 files across 3 systems.*  
*Last updated: 2026-06-13 — reflects Phases 1–11.*
