/**
 * Synco Privacy / Permission Metadata — Phase 8
 *
 * Carried by every RawEvent, Signal, Memory, and WikiEntry.
 * User owns all data. Private by default. Raw content is not kept forever.
 *
 * Design rules:
 * - private by default — no sharing without explicit user action
 * - raw content has a short default retention (7 days)
 * - derived meaning (signals, patterns) can survive after raw deletion
 * - user can always delete or export their data
 */

export type Visibility = 'private';   // only 'private' for now — future: shared, team

export type PermissionType =
  | 'user_explicit'     // user directly granted this
  | 'user_implicit'     // user typed it (implied consent)
  | 'system_derived'    // Synco derived it from other data
  | 'unknown';

export type SensitivityLevel =
  | 'public'            // no concern (e.g. generic task text)
  | 'personal'          // personal but not sensitive (e.g. task names)
  | 'sensitive'         // financial, health, relationships
  | 'highly_sensitive'; // passwords, medical, legal — extra caution

export type RetentionPolicy =
  | 'session_only'      // delete when session ends
  | '7_days'            // short-term raw retention
  | '30_days'
  | '90_days'
  | '1_year'
  | 'indefinite';       // user explicitly opted in to keep

// ─── Core type ────────────────────────────────────────────────────────────────

export interface PrivacyMetadata {
  ownerId:                string;         // always the userId
  visibility:             Visibility;     // 'private' by default
  permissionType:         PermissionType;
  sensitivityLevel:       SensitivityLevel;
  retentionPolicy:        RetentionPolicy;    // for raw content
  derivedMemoryRetention: RetentionPolicy;    // for signals/memories derived from this
  canDelete:              boolean;        // always true — user can delete
  canExport:              boolean;        // always true — user can export
  rawRetentionUntil?:     string;         // ISO date — when raw content should be purged
  notes?:                 string;         // optional internal note
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function defaultPrivacy(userId: string): PrivacyMetadata {
  const rawRetentionUntil = new Date(Date.now() + 7 * 86_400_000).toISOString();
  return {
    ownerId:                userId,
    visibility:             'private',
    permissionType:         'user_implicit',
    sensitivityLevel:       'personal',
    retentionPolicy:        '7_days',
    derivedMemoryRetention: '1_year',
    canDelete:              true,
    canExport:              true,
    rawRetentionUntil,
  };
}

export function sensitivePrivacy(userId: string): PrivacyMetadata {
  return {
    ...defaultPrivacy(userId),
    sensitivityLevel: 'sensitive',
    retentionPolicy:  '7_days',
  };
}

export function sessionOnlyPrivacy(userId: string): PrivacyMetadata {
  return {
    ...defaultPrivacy(userId),
    retentionPolicy:        'session_only',
    derivedMemoryRetention: '30_days',
    rawRetentionUntil:      new Date().toISOString(), // purge immediately after session
  };
}
