/**
 * Synco Signal — Phase 8
 *
 * A Signal is meaning extracted from a RawEvent.
 * It is more durable than the raw event — it can survive after raw deletion.
 *
 * Pipeline position:
 *   RawEvent → MeaningEngine → [Signal] → MemoryRouter → Memory System
 */

import type { PrivacyMetadata } from './privacy.js';

// ─── Signal types ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'task_signal'           // something that should become a task
  | 'commitment_signal'     // user committed to doing something (or someone committed to them)
  | 'knowledge_signal'      // user learned / read / discovered something
  | 'emotional_signal'      // emotional state or friction detected
  | 'behavior_signal'       // behavioral pattern cue
  | 'interest_signal'       // user expressed interest in a topic
  | 'risk_signal'           // potential risk or problem
  | 'opportunity_signal'    // potential opportunity
  | 'relationship_signal'   // about a person / relationship
  | 'financial_signal'      // money, debts, payments, financial concern
  | 'project_signal';       // related to a specific project

export type EvidenceSource =
  | 'explicit_text'         // directly stated by user
  | 'implicit_pattern'      // inferred from patterns
  | 'entity_presence'       // a known entity was mentioned
  | 'keyword_match'         // matched a known keyword
  | 'context_inference';    // inferred from surrounding context

// ─── Related entity in a signal ───────────────────────────────────────────────

export interface SignalEntity {
  name:       string;
  entityType: 'person' | 'project' | 'place' | 'organization' | 'topic' | 'unknown';
  isKnown:    boolean;    // false = should trigger an open question
}

// ─── Core Signal type ─────────────────────────────────────────────────────────

export interface Signal {
  signalId:              string;
  userId:                string;
  signalType:            SignalType;
  title:                 string;          // short human-readable label (English, internal)
  summary:               string;          // one-line description of what was detected
  confidence:            number;          // 0–1
  evidenceSource:        EvidenceSource;
  rawEventId?:           string;          // link back to source RawEvent (if available)
  relatedEntities:       SignalEntity[];
  suggestedMemoryType:   SuggestedMemoryType;
  suggestedAction:       SuggestedAction | null;

  // Routing flags — what should happen downstream
  shouldCreateTask:          boolean;
  shouldCreateOpenQuestion:  boolean;
  shouldUpdateWiki:          boolean;
  shouldUpdateGraph:         boolean;

  privacy: PrivacyMetadata;
  detectedAt: string;    // ISO 8601
}

// ─── Downstream suggestions ───────────────────────────────────────────────────

export type SuggestedMemoryType =
  | 'episodic'      // what happened
  | 'behavioral'    // how user behaves
  | 'knowledge'     // what user learned
  | 'preference'    // what matters to user
  | 'commitment';   // what user promised / needs to follow up

export interface SuggestedAction {
  actionType: 'create_task' | 'create_open_question' | 'update_wiki' | 'update_graph' | 'notify' | 'none';
  description: string;    // internal English description
  priority: 'high' | 'medium' | 'low';
}

// ─── Factory ──────────────────────────────────────────────────────────────────

import { defaultPrivacy, sensitivePrivacy } from './privacy.js';

export function createSignal(
  userId: string,
  signalType: SignalType,
  title: string,
  summary: string,
  overrides: Partial<Signal> = {},
): Signal {
  const isFinancial = signalType === 'financial_signal';
  return {
    signalId:             `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    signalType,
    title,
    summary,
    confidence:           0.6,
    evidenceSource:       'keyword_match',
    relatedEntities:      [],
    suggestedMemoryType:  signalTypeToMemoryType(signalType),
    suggestedAction:      null,
    shouldCreateTask:          signalType === 'task_signal' || signalType === 'commitment_signal',
    shouldCreateOpenQuestion:  false,
    shouldUpdateWiki:          signalType === 'knowledge_signal' || signalType === 'interest_signal',
    shouldUpdateGraph:         signalType === 'relationship_signal' || signalType === 'project_signal',
    privacy:              isFinancial ? sensitivePrivacy(userId) : defaultPrivacy(userId),
    detectedAt:           new Date().toISOString(),
    ...overrides,
  };
}

function signalTypeToMemoryType(st: SignalType): SuggestedMemoryType {
  switch (st) {
    case 'task_signal':        return 'episodic';
    case 'commitment_signal':  return 'commitment';
    case 'knowledge_signal':   return 'knowledge';
    case 'interest_signal':    return 'knowledge';
    case 'emotional_signal':   return 'behavioral';
    case 'behavior_signal':    return 'behavioral';
    case 'risk_signal':        return 'episodic';
    case 'opportunity_signal': return 'preference';
    case 'relationship_signal':return 'episodic';
    case 'financial_signal':   return 'commitment';
    case 'project_signal':     return 'episodic';
  }
}
