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
  → runBrainPipeline (brainPipeline.ts):
      → analyzeInputContext (inputContextAnalyzer.ts → pure)
      → generateOpenQuestionsFromContext (inputContextAnalyzer.ts → pure)
      → persistDeferredQuestions (openQuestions.ts → Postgres: OpenQuestion)
      → runSyncoThinkingLayer (syncoThinkingLayer.ts → pure):
          → detectPatterns
          → applyDecayToPatterns (patternDecay.ts → pure)
          → applyTrendOverrideToPatterns (recentTrendAnalyzer.ts → pure)
          → explainPatterns (patternExplainability.ts → pure)
          → createCausalHypotheses
          → predictRisks
      → evaluateDecision (decisionSupport.ts → pure)
      → generateRecommendation (brainRecommendation.ts → pure)
  → return BrainPipelineResult (attached to quick response)
```

### System C — Continuous Brain
```
POST /api/brain/share
  → createRawEvent (types/rawEvent.ts → pure)
  → runContinuousBrainFoundation (continuousBrainPipeline.ts):
      → runMeaningEngine (meaningEngine.ts → pure):
          → extractPersonEntities (Hebrew regex)
          → detect: commitment, financial, knowledge, interest, emotional, risk signals
          → build: wikiUpdateHints, graphUpdateHints, openQuestions
      → routeSignalsToMemory (memoryRouter.ts → pure):
          → route signals → episodic/behavioral/knowledge/preference/commitment
          → build: WikiUpdateCandidate[], GraphUpdateCandidate[]
  [if persist=true]:
  → saveRawEvent (rawEventStore.ts → Postgres: RawCaptureEvent)
  → persistFromRoutingPlan (persistFromRoutingPlan.ts):
      → saveSignals (signalStore.ts → Postgres: BrainSignal)
      → persistDeferredQuestions (openQuestions.ts → Postgres: OpenQuestion)
      → upsertWikiUpdateCandidates (personalWikiStore.ts → Postgres: WikiEntry)
      → upsertGraphUpdateCandidates (knowledgeGraphStore.ts → Postgres: GraphNode, GraphEdge)
  → return Hebrew summary + signals + openQuestions + persisted counts

GET /api/brain/retrieve
  → retrieveContinuousBrainContext (brainContextRetrieval.ts):
      [parallel]:
      → getWikiEntriesForQuery (wikiRetrieval.ts → Postgres: WikiEntry)
      → getSignalsForQuery (signalRetrieval.ts → Postgres: BrainSignal)
      → findGraphNodesByLabel (graphRetrieval.ts → Postgres: GraphNode)
      [sequential]:
      → getGraphContextForNode (graphRetrieval.ts → Postgres: GraphEdge + GraphNode)
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
| `OpenQuestion` | `openQuestions.ts` (via 3 callers) | `openQuestions.ts`, `openQuestions.ts` route |
| `RawCaptureEvent` | `rawEventStore.ts` | `rawEventStore.ts` |
| `BrainSignal` | `signalStore.ts` | `signalStore.ts`, `signalRetrieval.ts` |
| `WikiEntry` | `personalWikiStore.ts` | `personalWikiStore.ts`, `wikiRetrieval.ts` |
| `GraphNode` | `knowledgeGraphStore.ts` | `knowledgeGraphStore.ts`, `graphRetrieval.ts` |
| `GraphEdge` | `knowledgeGraphStore.ts` | `knowledgeGraphStore.ts`, `graphRetrieval.ts` |
| `OnboardingState` | `onboarding.ts` | `onboarding.ts` |
| `PlanningDraft` | `planning-drafts.ts` | `planning-drafts.ts` |

### Unused in Postgres Schema
| Table | Status |
|-------|--------|
| `InsightLog` | Defined in schema, never written to. Insights go to Qdrant via `memory.ts`. |
| `TaskFile`, `TaskRun`, `RunStep` | Early task-runner schema — not used by current UserTask flow. |

### Qdrant Collections (not yet connected)
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
| `POST /quick` | `brainPipeline`, `memoryLoader`, `lifeRuleLoader`, `syncoThinkingLayer`, `inputContextAnalyzer`, `decisionSupport`, `brainRecommendation`, `patternDecay`, `recentTrendAnalyzer`, `patternExplainability`, `rescheduleBurstCollapse`, `openQuestions` |
| `POST /api/brain/process` | `brain/index.ts`, `memory`, `localAnalyzer`, `aiAnalyzer`, `understanding`, `policy`, `curiosity`, `openQuestions` |
| `POST /api/brain/approve` | `policy` (updateLearningState) |
| `POST /api/brain/curiosity/answer` | `curiosity`, `brain/index.ts` |
| `GET /api/brain/status/:userId` | `policy`, `localAnalyzer`, `curiosity` |
| `POST /api/brain/share` | `continuousBrainPipeline`, `meaningEngine`, `memoryRouter`, `rawEventStore`, `signalStore`, `personalWikiStore`, `knowledgeGraphStore`, `persistFromRoutingPlan`, `openQuestions`, `localization/he` |
| `GET /api/brain/retrieve` | `brainContextRetrieval`, `wikiRetrieval`, `signalRetrieval`, `graphRetrieval`, `localization/he` |
| `GET /api/brain/share/status/:userId` | `rawEventStore` |
| `POST /api/learning` (learning.ts) | `memory`, `learningMemoryDerivation`, `learningIntegrityGate`, `rescheduleBurstDetector` |
| `GET /api/openQuestions` | `openQuestions` |

---

## 5. What Is Production-Ready

These modules are stable, tested, and in the live request path:

| Module | Evidence |
|--------|----------|
| `openQuestions.ts` | Dedup logic, used by 3 call sites, has DB constraints |
| `memoryLoader.ts` | Reads LearningEvent, burst-collapse, fail-open, used by /quick |
| `lifeRuleLoader.ts` | Pure mapping + fail-open loader, used by /quick |
| `runBrainPipeline()` (System B) | Used by every task creation via /quick |
| `syncoThinkingLayer` functions | Pure, 50+ passing tests across phases 4-7 |
| `patternDecay`, `recentTrendAnalyzer`, `patternExplainability` | Pure, tested |
| `brainRecommendation.ts` | Hebrew output, used by /quick |
| `inputContextAnalyzer.ts` | Pure, produces open questions in production |
| `localization/he.ts` | Covers share + retrieve + recommendation messages |

---

## 6. What Is Experimental

| Module | Reason |
|--------|--------|
| **System A (`brain/index.ts`)** | Requires OpenAI + Qdrant. Both may be unavailable. Used only by `/api/brain/process` — not in the main task creation path. |
| `aiAnalyzer.ts` | OpenAI-dependent, gated behind cooldown. No tests. |
| `understanding.ts` | OpenAI-dependent. No tests. Prompt is hardcoded. |
| `curiosity.ts` | In-memory only — lost on server restart. No persistence guarantee. |
| `policy.ts` | In-memory Map + Qdrant for trust levels. Qdrant fallback = silent fail = state lost. |
| **System C (`/api/brain/share`, `/api/brain/retrieve`)** | Built and tested, but not yet wired into the main task flow. DEV badge in UI. |
| `brainContextRetrieval.ts` | Postgres ILIKE only — no semantic matching. Returns empty if DB has no data. |

---

## 7. What Is Persisted

### Persisted to Postgres (durable)
| Data | Written by | Table |
|------|-----------|-------|
| Task events | `learning.ts` | `LearningEvent` |
| User tasks | `quick.ts`, `user-tasks.ts` | `UserTask` |
| Open questions | `openQuestions.ts` (3 callers) | `OpenQuestion` |
| Life rules | settings/UI | `LifeRule` |
| Raw capture events | `rawEventStore.ts` | `RawCaptureEvent` |
| Brain signals | `signalStore.ts` | `BrainSignal` |
| Wiki entries | `personalWikiStore.ts` | `WikiEntry` |
| Graph nodes + edges | `knowledgeGraphStore.ts` | `GraphNode`, `GraphEdge` |

### Persisted to Qdrant (conditional — requires connection)
| Data | Written by | Collection |
|------|-----------|-----------|
| User messages | `memory.ts → storeUserMessage` | `user_events` |
| Brain insights | `memory.ts → storeInsight` | `user_insights` |
| Learning state | `policy.ts → storeLearningState` | `user_profile` |
| Factual memories from events | `learningMemoryDerivation.ts` | `user_events` |

### In-memory only (lost on restart)
| Data | Location |
|------|----------|
| Curiosity question queue | `curiosity.ts: curiosityQueues Map` |
| Trust level / learning state | `policy.ts: userStates Map` (Qdrant is backup but fallback-silent) |

---

## 8. What Is Retrieval-Only

These modules only read from DB; they never write:

| Module | Reads from |
|--------|-----------|
| `wikiRetrieval.ts` | `WikiEntry` |
| `signalRetrieval.ts` | `BrainSignal` |
| `graphRetrieval.ts` | `GraphNode`, `GraphEdge` |
| `brainContextRetrieval.ts` | All three above (orchestrator) |
| `memoryLoader.ts` | `LearningEvent` |
| `lifeRuleLoader.ts` | `LifeRule` |

---

## 9. What Is Still Planned

### Not yet implemented
- **System C → /quick connection**: `retrieveContinuousBrainContext` result not yet fed into `runBrainPipeline`. Wiki/signal/graph context is stored but never read by the pattern engine.
- **Qdrant retrieval in System C**: All `brainContextRetrieval` uses ILIKE only. Semantic search not connected.
- **Open question answer → wiki update**: When user answers a `who_is_person` question, that answer should update `WikiEntry` and `GraphNode`. Currently answers are stored in `OpenQuestion.answerText` but not propagated.
- **Graph visualization UI**: `GraphNode`/`GraphEdge` data exists but no frontend renders it.
- **Wiki viewer UI**: `WikiEntry` data exists but no page shows it to the user.
- **Automatic System C trigger on task creation**: Continuous brain runs only when `/api/brain/share` is called explicitly. Not triggered automatically by `/quick`.
- **Episodic/behavioral/knowledge/preference/commitment memory persistence**: `MemoryRouter` plans these but `persistFromRoutingPlan` explicitly logs them as `planned_only`. They are never written to DB.
- **Qdrant connections for production**: The Qdrant client is initialized from env vars. If not set, all Qdrant operations silently no-op. No connection has been made in Replit yet.

### Planned but deferred
- Cross-signal temporal analysis (time-aware pattern detection in System C)
- Confidence decay in WikiEntry over time (entries grow stale)
- Graph traversal for second-degree connections
- Proactive recommendations based on accumulated graph + wiki context

---

## 10. Current Technical Debt

### TD-1: Duplicate person extraction logic
`meaningEngine.ts` (System C) and `inputContextAnalyzer.ts` (System B) both extract Hebrew person names from text using independent regex implementations. They will diverge. Should be a single shared `extractPersonEntities()` utility.

### TD-2: `curiosity.ts` has no persistence
`curiosityQueues` is an in-memory `Map`. Server restart silently clears all pending questions. `persistDeferredQuestions` also writes to `OpenQuestion` but the in-memory queue and the DB are not synchronized — they are two separate mechanisms.

### TD-3: `policy.ts` trust state is unreliable
`userStates` Map is in-memory. Qdrant backup exists but fails silently. Every restart resets trust level to "learning". The feature appears production-wired but behavior is undefined after any restart.

### TD-4: System A and System B run independently with no shared state
`processBrainInput` (System A) and `runBrainPipeline` (System B) both analyze the same user text but share zero state. System A uses Qdrant memories; System B uses Postgres LearningEvents. Neither knows what the other concluded.

### TD-5: `syncoThinkingLayer.ts` contains both types and logic
The file defines `SyncoMemory`, `SyncoPattern`, `CausalHypothesis`, `PredictionRisk`, `LifeRule`, `DecisionCandidate` AND implements `detectPatterns`, `runSyncoThinkingLayer`, etc. Types should be extracted to `types/`.

### TD-6: `OpenQuestion` table has three distinct call sites with no tagging
`openQuestions.ts` is called from System A (`brain/index.ts`), System B (`brainPipeline.ts`), and System C (`persistFromRoutingPlan.ts`). The `sourceInputRoute` field differentiates them but there is no structured enum — it is a free-form string.

### TD-7: `persistedCounts.graphNodes` counts both created and updated nodes
In `persistFromRoutingPlan.ts`, `graphNodes = nodesCreated + nodesUpdated`. This means the Hebrew summary "הוספתי X פריטים לגרף" may count nodes that already existed. A user may see "added 3 items" when 2 were pre-existing.

### TD-8: MeaningEngine `financial_signal` always creates node labeled `"הקשר פיננסי"`
`graphUpdateHints.push({ nodeType: 'financial_issue', label: 'הקשר פיננסי' })` — every financial text creates/updates the same single node, regardless of amount, person, or context. This collapses all financial context into one undifferentiated node.

### TD-9: `memory.ts` is used by both System A and System B indirectly
`storeUserMessage`, `buildContext`, `storeLearningState`, `loadLearningState` are all in one file with mixed Qdrant and non-Qdrant logic. Coupling makes it hard to test.

### TD-10: Two `.bak` files in routes
`server/routes/learning.ts.bak_20260605_202736` and `learning.ts.bak_20260605_112458` are committed artifacts. They appear in the codebase and create noise.

---

## 11. Current Unused Modules

| Module | Reason unused |
|--------|--------------|
| `settledRescheduleDeriver.ts` | Defined in Phase 4a but never imported by any other file. Intended to write settled reschedule facts to Qdrant after burst window. |
| `diagnostics/brainDiagnostics.ts` | Exports `runBrainDiagnostics()` but is never imported. The `brainPipeline.ts` header comment mentions it but never imports it. Diagnostics in brainPipeline are built inline. |
| `evidenceScoring.ts` | Only imported by `brainDiagnostics.ts`, which is itself never called. Effectively dead code. |
| `InsightLog` (Prisma model) | Schema model exists. Brain insights go to Qdrant via `storeInsight()`. `InsightLog` table is never written to from application code. |
| `TaskFile`, `TaskRun`, `RunStep` (Prisma models) | Appear to be from an earlier task-runner design. The current task system uses `UserTask`. These three models are never referenced from brain or route code. |

---

## 12. Current Duplicate Logic

| Logic | Duplicated in | Recommendation |
|-------|--------------|----------------|
| Hebrew person extraction (regex) | `meaningEngine.ts` (ATTACHED_PREP_RE + SEPARATE_PREP_RE + GENERIC_WORDS) AND `inputContextAnalyzer.ts` (DetectedEntity extraction) | Extract to `server/brain/utils/hebrewEntityExtractor.ts` |
| `mergeSignalIds(existing, incoming)` | `personalWikiStore.ts` AND `knowledgeGraphStore.ts` | Extract to `server/brain/utils/arrayMerge.ts` |
| `persistDeferredQuestions` call pattern | Called from `brain/index.ts`, `brainPipeline.ts`, `persistFromRoutingPlan.ts` — each with different `sourceInputRoute` strings | No code duplication, but inconsistent route labels. Define as constants. |
| Confidence clamping `Math.max(0, Math.min(1, ...))` | `patternDecay.ts`, `knowledgeGraphStore.ts`, `syncoThinkingLayer.ts` | Extract to `clamp01()` utility (already exists in syncoThinkingLayer but not exported) |
| `safeFallback(error)` pattern | `brainPipeline.ts` AND `continuousBrainPipeline.ts` — both return typed fallback result | Could share a generic `makeSafeFallback<T>` helper |

---

## 13. Recommended Next Phases in Order

### Phase 11 — Connect System C to /quick (Critical Path)
**Why now:** System C can persist and retrieve knowledge, but that knowledge never influences task creation. The main product value loop is broken.  
**What to build:**
- In `quick.ts`, after task is created, call `runContinuousBrainFromText()` (fire-and-forget, same as brainPipeline)
- Pass the result's `wikiUpdateCandidates` + `graphUpdateCandidates` + `signals` to `persistFromRoutingPlan` when `persist=true`
- Feed retrieved context (wiki entries + graph nodes for detected entities) into `brainPipeline` as additional context signals
- **Do not replace** existing brainPipeline flow

---

### Phase 12 — Open Question Answer → Knowledge Update
**Why now:** Answers to `who_is_person` questions are stored in `OpenQuestion.answerText` but never used. The brain asks "מי זה דני?" and the answer disappears.  
**What to build:**
- Service: `applyOpenQuestionAnswer(userId, questionId, answerText)` 
- On answer: update `WikiEntry` for the person topic + update `GraphNode` label confidence
- Route: extend `POST /api/openQuestions/:id/answer`
- This closes the capture → question → answer → knowledge loop

---

### Phase 13 — Personal Wiki + Graph UI
**Why now:** Data is persisted and retrievable but invisible to the user.  
**What to build:**
- `/wiki` page: list of WikiEntry cards, search by topic, expandable keyPoints
- `/graph` page: simple node-edge list (not full visualization) showing connected entities
- Both pages read-only via `GET /api/brain/retrieve?query=...`

---

### Phase 14 — Episodic/Behavioral Memory Persistence
**Why now:** `MemoryRouter` plans 5 memory types but only wiki + graph are persisted. `routedMemoryPersistence: planned_only` is the current state.  
**What to build:**
- New Prisma model: `MemoryEntry` (episodic + behavioral + knowledge + preference + commitment)
- Service: `memoryEntryStore.ts` with upsert logic
- Add to `persistFromRoutingPlan` after existing steps
- Remove the `planned_only` diagnostic note

---

### Phase 15 — Consolidate Person Extraction (TD-1)
**Why now:** System B and System C will diverge further as both evolve.  
**What to build:**
- `server/brain/utils/hebrewEntityExtractor.ts` — single source of ATTACHED_PREP_RE, SEPARATE_PREP_RE, GENERIC_WORDS
- Update `meaningEngine.ts` and `inputContextAnalyzer.ts` to import from it

---

### Phase 16 — Fix In-Memory State (TD-2, TD-3)
**Why:** `curiosity.ts` and `policy.ts` lose state on restart. This breaks user experience.  
**What to build:**
- Persist curiosity queue to `OpenQuestion` and sync on startup (or drop the in-memory queue entirely)
- Persist trust level to a `UserBrainState` Postgres table instead of Qdrant

---

### Phase 17 — Remove Unused Modules (TD-10, §11)
**What to do:**
- Delete `settledRescheduleDeriver.ts`, `diagnostics/brainDiagnostics.ts`, `evidenceScoring.ts`
- Remove `InsightLog`, `TaskFile`, `TaskRun`, `RunStep` from `schema.prisma`
- Delete `learning.ts.bak_*` files
- Run `prisma migrate` to drop orphan tables

---

### Phase 18 — Semantic Retrieval (Qdrant + System C)
**Why last:** Everything above is more impactful per effort. Semantic search adds precision but the core loops must work first.  
**What to build:**
- When `persistFromRoutingPlan` saves a WikiEntry, also upsert a vector embedding to Qdrant with topic + keyPoints concatenated
- Add vector search path to `wikiRetrieval.ts` as a fallback after ILIKE finds nothing
- Keep Qdrant fully optional — ILIKE must remain the primary path

---

*End of inventory. Total brain modules: 48 files across 3 systems.*
