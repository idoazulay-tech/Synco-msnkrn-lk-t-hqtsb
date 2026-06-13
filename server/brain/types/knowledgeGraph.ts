/**
 * Synco Knowledge Graph — Phase 8 (Types + Planner)
 *
 * The Knowledge Graph captures relationships between entities in the user's life.
 * It is built incrementally from signals.
 *
 * In Phase 8: pure planning only. No DB writes, no Qdrant.
 * Future phases will persist to a graph store.
 *
 * Pipeline position:
 *   Signal → MemoryRouter → [GraphUpdateCandidate] → (future) GraphPersistenceService
 */

import type { PrivacyMetadata } from './privacy.js';

// ─── Node types ───────────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'person'
  | 'project'
  | 'goal'
  | 'task'
  | 'topic'
  | 'habit'
  | 'place'
  | 'emotion'
  | 'financial_issue'
  | 'commitment'
  | 'life_rule';

export interface GraphNode {
  nodeId:    string;
  userId:    string;
  nodeType:  GraphNodeType;
  label:     string;            // e.g. "דני", "פרויקט X", "חרדה כלכלית"
  confidence: number;
  metadata:  Record<string, unknown>;
  privacy:   PrivacyMetadata;
  createdAt: string;            // ISO 8601
  updatedAt: string;
}

// ─── Edge / Relation types ────────────────────────────────────────────────────

export type GraphRelationType =
  | 'related_to'
  | 'causes_possible'
  | 'supports'
  | 'blocks'
  | 'belongs_to_project'
  | 'involves_person'
  | 'creates_commitment'
  | 'affects_energy'
  | 'affects_money'
  | 'affects_decision';

export interface GraphEdge {
  edgeId:            string;
  userId:            string;
  fromNodeId:        string;
  toNodeId:          string;
  relationType:      GraphRelationType;
  confidence:        number;
  evidenceSignalIds: string[];
  createdAt:         string;
}

// ─── Update candidates (planned, not yet persisted) ───────────────────────────

export interface NodeToCreate {
  nodeType:   GraphNodeType;
  label:      string;
  confidence: number;
  metadata?:  Record<string, unknown>;
  fromSignalId?: string;
}

export interface EdgeToCreate {
  fromLabel:    string;             // resolved at persistence time
  toLabel:      string;
  relationType: GraphRelationType;
  confidence:   number;
  evidenceSignalIds: string[];
}

export interface NodeToUpdate {
  label:      string;               // identifies existing node
  nodeType:   GraphNodeType;
  confidence: number;
  metadata?:  Record<string, unknown>;
}

export interface GraphUpdateCandidate {
  nodesToCreate: NodeToCreate[];
  edgesToCreate: EdgeToCreate[];
  nodesToUpdate: NodeToUpdate[];
  diagnostics:   string[];          // internal notes on why updates were planned
}
