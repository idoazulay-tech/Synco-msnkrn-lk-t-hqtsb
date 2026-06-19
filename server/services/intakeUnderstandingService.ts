/**
 * intakeUnderstandingService.ts
 *
 * Orchestrates intake understanding:
 *   1. AI-first (if SYNCO_AI_ENABLED=true and OpenAI key available)
 *   2. Deterministic smart fallback (always works, no external deps)
 *
 * Reuses existing chatCompletion() from brain/utils/openai-client.ts
 * — the same pattern used by planner.ts.
 */

import { parseIntakeDeterministic } from './intakeDeterministicParser.js';
import type { SyncoIntakePreview } from './intakeDeterministicParser.js';
import { hasOpenAIKey } from '../ai/aiFeatureFlags.js';
import { chatCompletion } from '../brain/utils/openai-client.js';

export type { SyncoIntakePreview } from './intakeDeterministicParser.js';
export type {
  SyncoNowAction,
  SyncoTodayTask,
  SyncoLaterTask,
  SyncoProject,
  SyncoProjectStep,
  SyncoOpenQuestion,
  SyncoNote,
  SyncoEntities,
} from './intakeDeterministicParser.js';

// ─── AI system prompt ─────────────────────────────────────────────────────────

const INTAKE_SYSTEM_PROMPT = `אתה מומחה ארגון אישי לאנשים עם ADHD שמדברים עברית.

קיבלת קלט חופשי — עשוי להיות בלגן, מחשבות פרועות, תחושות ומשימות מעורבות.

המשימה שלך:
1. לזהות ולהפריד:
   - רגשות ועומס (→ notes, לא tasks)
   - שמות עצם בלבד (→ להמיר לפעולות ברות ביצוע)
   - פעולות קונקרטיות (→ todayTasks)
   - נושאים גדולים (→ projects עם שלבים)
   - שאלות פתוחות (→ openQuestions)
2. לא לייצר tasks מביטויים רגשיים ("אני מוצף", "לא יודע מה לעשות")
3. לא לייצר tasks משמות עצם בלבד — תמיד להמיר לפועל ("החובות" → "לרשום את כל החובות")
4. כל פרויקט חייב 3-7 שלבים ו-firstActionTitle
5. חייב להיות בדיוק nowAction אחד — הפעולה הכי קטנה וברורה שניתן לעשות עכשיו
6. כל הפלט בעברית (מלבד מונחים טכניים כמו ICP, MVP, B2B)

החזר JSON בדיוק בפורמט הזה:
{
  "nowAction": {
    "title": "string — כותרת קצרה, פועל בהתחלה",
    "firstStep": "string — הצעד הראשון הקטן ביותר",
    "duration": number,
    "priority": "high"|"medium"|"low",
    "reason": "string — למה זה עכשיו",
    "confidence": number,
    "linkedProjectTempId": "string|null",
    "source": "intake"
  },
  "todayTasks": [{"title":"string","firstStep":"string|null","duration":number|null,"priority":"high"|"medium"|"low"|null,"reason":"string|null","linkedProjectTempId":"string|null"}],
  "laterTasks": [{"title":"string","firstStep":"string|null","reason":"string|null","linkedProjectTempId":"string|null"}],
  "projects": [{
    "tempId": "string",
    "title": "string",
    "goal": "string",
    "priority": "high"|"medium"|"low"|null,
    "reason": "string",
    "firstActionTitle": "string",
    "steps": [{"title":"string","orderIndex":number,"suggestedDuration":number|null,"status":"pending"}]
  }],
  "openQuestions": [{"question":"string","reason":"string","blocksScheduling":boolean}],
  "notes": [{"text":"string","reason":"string","category":"concern"|"emotion"|"context"|"memory"|"overload"|null}],
  "entities": {
    "people": ["string"],
    "places": ["string"],
    "times": ["string"],
    "dates": ["string"],
    "priorities": ["string"],
    "topics": ["string"],
    "emotions": ["string"]
  },
  "warnings": ["string"]
}`;

// ─── AI validation / normalization ────────────────────────────────────────────

function normalizeAIResult(raw: unknown): SyncoIntakePreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  // Must have nowAction (or null for empty input)
  if (!('nowAction' in r)) return null;

  const preview: SyncoIntakePreview = {
    nowAction:     normalizeNowAction(r.nowAction),
    todayTasks:    Array.isArray(r.todayTasks) ? r.todayTasks as SyncoIntakePreview['todayTasks'] : [],
    laterTasks:    Array.isArray(r.laterTasks) ? r.laterTasks as SyncoIntakePreview['laterTasks'] : [],
    projects:      Array.isArray(r.projects)   ? r.projects   as SyncoIntakePreview['projects']   : [],
    openQuestions: Array.isArray(r.openQuestions) ? r.openQuestions as SyncoIntakePreview['openQuestions'] : [],
    notes:         Array.isArray(r.notes)      ? r.notes      as SyncoIntakePreview['notes']      : [],
    entities:      normalizeEntities(r.entities),
    warnings:      Array.isArray(r.warnings)   ? r.warnings as string[] : [],
  };

  // Ensure projects have 3+ steps
  for (const proj of preview.projects) {
    if (!Array.isArray(proj.steps) || proj.steps.length < 3) return null;
    if (!proj.firstActionTitle || !proj.tempId) return null;
  }

  return preview;
}

function normalizeNowAction(raw: unknown): SyncoIntakePreview['nowAction'] {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!r.title || typeof r.title !== 'string') return null;
  return {
    title:               String(r.title),
    firstStep:           String(r.firstStep ?? r.title),
    duration:            Number(r.duration ?? 30),
    priority:            (r.priority as 'high' | 'medium' | 'low') ?? 'medium',
    reason:              String(r.reason ?? ''),
    confidence:          Number(r.confidence ?? 0.8),
    linkedProjectTempId: r.linkedProjectTempId ? String(r.linkedProjectTempId) : undefined,
    source:              'intake',
  };
}

// Words that are product/domain identifiers and must never appear in places[]
const DOMAIN_KEYWORDS_NOT_PLACES = new Set([
  'סינקו', 'synco', 'icp', 'mvp', 'b2b', 'ולידציה', 'validation',
  'מוצר', 'product', 'לקוחות', 'runway', 'pivot', 'פיבוט',
  'landing', 'לנדינג', 'go to market',
]);

function normalizeEntities(raw: unknown): SyncoIntakePreview['entities'] {
  const empty = { people: [], places: [], times: [], dates: [], priorities: [], topics: [], emotions: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;
  const rawPlaces = Array.isArray(r.places) ? r.places as string[] : [];
  return {
    people:    Array.isArray(r.people)    ? r.people    as string[] : [],
    places:    rawPlaces.filter(p => !DOMAIN_KEYWORDS_NOT_PLACES.has(p.toLowerCase())),
    times:     Array.isArray(r.times)     ? r.times     as string[] : [],
    dates:     Array.isArray(r.dates)     ? r.dates     as string[] : [],
    priorities: Array.isArray(r.priorities) ? r.priorities as string[] : [],
    topics:    Array.isArray(r.topics)    ? r.topics    as string[] : [],
    emotions:  Array.isArray(r.emotions)  ? r.emotions  as string[] : [],
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function understandIntake(
  text: string,
  _userId: string,
): Promise<SyncoIntakePreview & { _source: 'ai' | 'deterministic' }> {

  if (!text || !text.trim()) {
    return {
      ...parseIntakeDeterministic(''),
      _source: 'deterministic',
    };
  }

  // Try AI if available
  const aiEnabled = process.env.SYNCO_AI_ENABLED === 'true' && hasOpenAIKey();
  if (aiEnabled) {
    try {
      const userMsg = `המשתמש הקליד:\n"${text.trim()}"\n\nנתח ותחזיר JSON:`;
      const rawContent = await chatCompletion(INTAKE_SYSTEM_PROMPT, userMsg, {
        temperature: 0.2,
        jsonMode:    true,
        maxTokens:   3000,
      });

      let parsed: unknown;
      try { parsed = JSON.parse(rawContent); } catch { parsed = null; }

      const normalized = parsed ? normalizeAIResult(parsed) : null;
      if (normalized) {
        // Safety net: run deterministic to catch domain projects the AI may have missed
        const detResult = parseIntakeDeterministic(text.trim());
        const aiTempIds = new Set(normalized.projects.map(p => p.tempId));

        for (const detProj of detResult.projects) {
          if (!aiTempIds.has(detProj.tempId)) {
            normalized.projects.push(detProj);
            // Link any todayTask that belongs to this newly added domain project
            for (const task of normalized.todayTasks) {
              if (!task.linkedProjectTempId && task.title) {
                if (detProj.tempId === 'proj_synco') {
                  const hasSyncoKeyword = /icp|סינקו|ולידציה|mvp|b2b/i.test(task.title);
                  const isPersonContact  = /^(לדבר\s+עם|להתקשר|לפגוש|שיחה\s+עם|לשלוח\s+ל|לכתוב\s+ל)/i.test(task.title);
                  if (hasSyncoKeyword || isPersonContact) {
                    task.linkedProjectTempId = detProj.tempId;
                  }
                } else if (detProj.tempId === 'proj_finance' && /בנק|חוב|שכירות|תשלום/i.test(task.title)) {
                  task.linkedProjectTempId = detProj.tempId;
                }
              }
            }
          }
        }

        // Ensure nowAction links to one of the final projects; replace with
        // deterministic nowAction if the AI-generated link is missing or stale
        if (normalized.nowAction) {
          const finalTempIds = new Set(normalized.projects.map(p => p.tempId));
          const linked = normalized.nowAction.linkedProjectTempId;
          if (!linked || !finalTempIds.has(linked)) {
            normalized.nowAction = detResult.nowAction;
          }
        }

        return { ...normalized, _source: 'ai' };
      }
      console.warn('[intakeUnderstandingService] AI result failed validation — falling back to deterministic');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[intakeUnderstandingService] AI call failed — falling back to deterministic:', msg);
    }
  }

  // Deterministic fallback (always available)
  return {
    ...parseIntakeDeterministic(text.trim()),
    _source: 'deterministic',
  };
}
