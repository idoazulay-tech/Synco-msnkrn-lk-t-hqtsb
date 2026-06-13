/**
 * Synco Personal Wiki — Phase 8 (Types + Planner)
 *
 * The Personal Wiki is a growing structured knowledge base about the user's world.
 * Each entry covers one topic and is updated as new signals arrive.
 *
 * In Phase 8: pure planning only. No DB writes.
 * Future phases will persist entries to Postgres / vector store.
 *
 * Pipeline position:
 *   Signal → MemoryRouter → [WikiUpdateCandidate] → (future) WikiPersistenceService
 */

import type { PrivacyMetadata } from './privacy.js';

// ─── Wiki entry ────────────────────────────────────────────────────────────────

export interface PersonalWikiEntry {
  entryId:        string;
  userId:         string;
  topic:          string;         // e.g. "דני", "פרויקט X", "חובות", "בריאות"
  parentTopic?:   string;         // optional hierarchy, e.g. "כלכלה" → "חובות"
  summary:        string;         // one paragraph about this topic
  keyPoints:      string[];       // bulleted facts we know
  sourceSignals:  string[];       // signalIds that contributed to this entry
  confidence:     number;         // how confident we are in the entry's accuracy
  updatedAt:      string;         // ISO 8601
  privacy:        PrivacyMetadata;
}

// ─── Update candidate (planned, not yet persisted) ────────────────────────────

export type WikiUpdateAction = 'create' | 'update' | 'merge';

export interface WikiUpdateCandidate {
  topic:           string;
  action:          WikiUpdateAction;
  reason:          string;          // why this update was triggered (English, internal)
  newKeyPoints:    string[];        // points to add or update
  existingEntryId?: string;         // if action = 'update' | 'merge'
  confidence:      number;
  sourceSignalIds: string[];
}
