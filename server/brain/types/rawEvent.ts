/**
 * Synco RawEvent — Phase 8
 *
 * A RawEvent is the earliest capture of something that happened.
 * It exists before Synco fully understands the content.
 * Raw content is NOT kept forever by default — retentionPolicy controls this.
 *
 * Pipeline position:
 *   Capture → [RawEvent] → MeaningEngine → Signal → MemoryRouter → Memory System
 */

import type { PrivacyMetadata } from './privacy.js';

// ─── Source types ─────────────────────────────────────────────────────────────

export type RawEventSourceType =
  | 'quick_input'        // user typed into the quick /quick endpoint
  | 'shared_text'        // user pasted or shared text from another app
  | 'article_paste'      // user pasted an article / URL content
  | 'calendar_event'     // pulled from calendar (future)
  | 'email'              // pulled from email (future)
  | 'whatsapp'           // pulled from WhatsApp (future)
  | 'voice'              // voice memo (future)
  | 'screen_capture'     // screenshot / screen reading (future)
  | 'file'               // file uploaded (future)
  | 'video_transcript'   // video / podcast transcript (future)
  | 'api_push'           // pushed from external integration (future)
  | 'unknown';

export type RawContentType =
  | 'text'
  | 'url'
  | 'json'
  | 'audio_transcript'
  | 'image_ocr'
  | 'markdown'
  | 'unknown';

export type ProcessingStatus =
  | 'pending'            // just captured, not yet processed
  | 'processing'         // MeaningEngine running
  | 'processed'          // signals extracted, signals available
  | 'failed'             // processing error
  | 'skipped';           // filtered out before processing (privacy/policy)

// ─── RawEvent ─────────────────────────────────────────────────────────────────

export interface RawEvent {
  rawEventId:       string;
  userId:           string;
  sourceType:       RawEventSourceType;
  sourceName:       string;           // e.g. "quick_input", "WhatsApp", "Gmail"
  capturedAt:       string;           // ISO 8601
  rawContent:       string;           // original text/content (may be deleted after retention)
  contentType:      RawContentType;
  processingStatus: ProcessingStatus;
  privacy:          PrivacyMetadata;
  metadata:         RawEventMetadata;
}

export interface RawEventMetadata {
  characterCount?:  number;
  languageHint?:    'he' | 'en' | 'mixed' | 'unknown';
  relatedTaskId?:   string;
  relatedTaskTitle?: string;
  clientVersion?:   string;
  ipRegion?:        string;           // coarse location, never precise
  sessionId?:       string;
  [key: string]:    unknown;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

import { defaultPrivacy } from './privacy.js';

export function createRawEvent(
  userId: string,
  rawContent: string,
  sourceType: RawEventSourceType = 'quick_input',
  overrides: Partial<RawEvent> = {},
): RawEvent {
  const now = new Date().toISOString();
  return {
    rawEventId:       `re-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    sourceType,
    sourceName:       sourceType,
    capturedAt:       now,
    rawContent,
    contentType:      'text',
    processingStatus: 'pending',
    privacy:          defaultPrivacy(userId),
    metadata: {
      characterCount: rawContent.length,
      languageHint:   detectLanguageHint(rawContent),
    },
    ...overrides,
  };
}

function detectLanguageHint(text: string): RawEventMetadata['languageHint'] {
  const hebrewChars = (text.match(/[א-ת]/g) ?? []).length;
  const latinChars  = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = hebrewChars + latinChars;
  if (total === 0) return 'unknown';
  if (hebrewChars / total > 0.7) return 'he';
  if (latinChars  / total > 0.7) return 'en';
  return 'mixed';
}
