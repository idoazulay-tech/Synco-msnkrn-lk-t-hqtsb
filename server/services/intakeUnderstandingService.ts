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

// ─── AI project domain normalizer ────────────────────────────────────────────
// Regex patterns that identify which canonical domain an AI-generated project
// belongs to (regardless of what tempId the AI chose).

const FINANCE_SIGNALS_RE = /חוב|בנק|שכירות|תשלום|ביטוח|מינוס|אשראי|כסף|כלכל|פיננס|finance|debt|budget|תקציב/i;
const SYNCO_SIGNALS_RE   = /icp|סינקו|ולידציה|mvp|מוצר|synco|b2b|לקוחות|startup|פרסונה|runway|pivot|פיבוט|validation|product/i;

export function detectProjectDomain(proj: { title: string; goal?: string; firstActionTitle?: string }): 'finance' | 'synco' | undefined {
  const text = [proj.title, proj.goal ?? '', proj.firstActionTitle ?? ''].join(' ');
  if (FINANCE_SIGNALS_RE.test(text)) return 'finance';
  if (SYNCO_SIGNALS_RE.test(text)) return 'synco';
  return undefined;
}

/**
 * Returns a mapping from each AI project's tempId to its canonical domain tempId.
 * Projects that are unrecognized are not included.
 * e.g. { "proj1": "proj_finance", "proj2": "proj_synco" }
 */
export function buildProjectTempIdRemap(
  projects: Array<{ tempId: string; title: string; goal?: string; firstActionTitle?: string }>,
): Record<string, string> {
  const remap: Record<string, string> = {};
  for (const proj of projects) {
    const domain = detectProjectDomain(proj);
    if (domain) remap[proj.tempId] = `proj_${domain}`;
  }
  return remap;
}

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
        const detResult = parseIntakeDeterministic(text.trim());

        // ── 1. Remap AI project tempIds to canonical domain tempIds ────────────
        // e.g. AI "proj1" (title: "ניהול כספים") → "proj_finance"
        const remap = buildProjectTempIdRemap(normalized.projects);
        for (const proj of normalized.projects) {
          if (remap[proj.tempId]) proj.tempId = remap[proj.tempId];
        }

        // ── 2. Deduplicate + merge with deterministic canonical projects ────────
        // Deterministic canonical always wins (has proper step templates).
        // Use Map so duplicate canonical tempIds collapse to one entry.
        const projMap = new Map<string, SyncoIntakePreview['projects'][number]>();
        for (const proj of normalized.projects) {
          if (!projMap.has(proj.tempId)) projMap.set(proj.tempId, proj);
        }
        for (const detProj of detResult.projects) {
          projMap.set(detProj.tempId, detProj); // canonical template always wins
        }
        normalized.projects = [...projMap.values()];

        // ── 3. Rewrite all linkedProjectTempId references ─────────────────────
        const rewrite = (id?: string): string | undefined =>
          id ? (remap[id] ?? id) : id;

        if (normalized.nowAction) {
          normalized.nowAction = {
            ...normalized.nowAction,
            linkedProjectTempId: rewrite(normalized.nowAction.linkedProjectTempId),
          };
        }
        for (const t of normalized.todayTasks) {
          if (t.linkedProjectTempId) t.linkedProjectTempId = rewrite(t.linkedProjectTempId);
        }
        for (const t of normalized.laterTasks) {
          if (t.linkedProjectTempId) t.linkedProjectTempId = rewrite(t.linkedProjectTempId);
        }

        // ── 4. Link any still-unlinked tasks ──────────────────────────────────
        const finalTempIds = new Set(normalized.projects.map(p => p.tempId));

        for (const t of normalized.todayTasks) {
          if (t.linkedProjectTempId) continue;
          if (!t.title) continue;
          if (finalTempIds.has('proj_synco')) {
            const hasSyncoKw      = /icp|סינקו|ולידציה|mvp|b2b/i.test(t.title);
            const isPersonContact  = /^(לדבר\s+עם|להתקשר|לפגוש|שיחה\s+עם|לשלוח\s+ל|לכתוב\s+ל)/i.test(t.title);
            if (hasSyncoKw || isPersonContact) { t.linkedProjectTempId = 'proj_synco'; continue; }
          }
          if (finalTempIds.has('proj_finance') && /בנק|חוב|שכירות|תשלום/i.test(t.title)) {
            t.linkedProjectTempId = 'proj_finance';
          }
        }

        // ── 5. Ensure nowAction links to a real project ────────────────────────
        if (normalized.nowAction) {
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
