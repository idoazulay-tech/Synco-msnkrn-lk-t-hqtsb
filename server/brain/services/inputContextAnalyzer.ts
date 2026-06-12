/**
 * Synco Input Context Analyzer
 *
 * Analyzes raw user text and extracts structured life context WITHOUT calling AI.
 * Returns typed signals about task intent, people, time, ambiguity, and what
 * information is missing. Upstream callers use this output to decide whether to
 * create Open Questions, block on clarification, or proceed silently.
 *
 * Design principles:
 * - Pure functions, no I/O, fully testable.
 * - Never modifies existing data.
 * - Produces signals, not decisions. Decision Support Engine decides what to do.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputIntentType =
  | "create_task"
  | "create_reminder"
  | "schedule_event"
  | "ask_question"
  | "check_in"
  | "express_preference"
  | "provide_context"
  | "unknown";

export type MissingInfoKind =
  | "who"        // unknown person entity
  | "what"       // vague task content
  | "when"       // no time reference
  | "where"      // no location when relevant
  | "which"      // ambiguous project / object
  | "how_much"   // no amount / payment target
  | "priority";  // no urgency cue

export type UrgencyLevel = "now" | "today" | "soon" | "someday" | "unknown";

export interface DetectedEntity {
  name: string;
  entityType: "person" | "project" | "place" | "organization" | "unknown";
  isKnown: boolean; // always false here — knowledge check is caller's job
  rawMatch: string;
}

export interface TimeReference {
  raw: string;
  type: "relative" | "absolute" | "vague";
  isDeadline: boolean;
}

export interface AnalyzedInputContext {
  originalText: string;
  intent: InputIntentType;
  urgency: UrgencyLevel;
  entities: DetectedEntity[];
  timeReferences: TimeReference[];
  missingInfo: MissingInfoKind[];
  ambiguityScore: number;       // 0–1, higher = more ambiguous
  requiresActionNow: boolean;
  shouldCreateOpenQuestion: boolean;
  shouldAskNow: boolean;        // vs. defer to Open Questions
  energyHint: "high" | "low" | "unknown";
  emotionalFriction: boolean;
  diagnostics: string[];
}

// ─── Hebrew entity patterns ───────────────────────────────────────────────────

const PERSON_PREFIXES_HE = [
  "עם", "לדבר עם", "לשלוח ל", "לקרוא ל", "לפגוש את", "פגישה עם",
  "להתקשר ל", "מ-", "ל-", "אצל", "של",
];

const GENERIC_TASK_WORDS = new Set([
  "משימה", "משימת", "בדיקה", "פרויקט", "עבודה", "דוח", "פירוק",
  "תזכורת", "דבר", "נושא", "ישיבה", "פגישה", "שיחה", "דיון",
  "ענין", "עניין", "נושאים", "רשימה", "תכנון", "מטלה", "הכל",
  "מישהו", "מישהי", "כולם",
]);

const HEBREW_STOP_SECOND_WORDS = new Set([
  "על", "את", "של", "אל", "מן", "בין", "כי", "אם", "כש", "עד",
  "אחרי", "לפני", "בגלל", "כדי", "למרות", "אחר", "תחת", "מול",
  // time words that regex may capture as part of a two-word name
  "היום", "מחר", "הערב", "הלילה", "הבוקר", "עכשיו", "בבוקר",
]);

// Hebrew name heuristic: 2+ Hebrew uppercase-equivalent letters
const HEBREW_WORD_RE = /[א-ת]{2,}/g;

const URGENCY_PATTERNS: { re: RegExp; level: UrgencyLevel }[] = [
  { re: /עכשיו|מיד|דחוף|הכי קרוב|כרגע/u, level: "now" },
  { re: /היום|הערב|הלילה|בבוקר|עד הסוף|לפני הצהריים/u, level: "today" },
  { re: /מחר|השבוע|בקרוב|近期|ב?ימים הקרובים/u, level: "soon" },
  { re: /אי ?פעם|בסוף|כשיהיה זמן|אחד הימים/u, level: "someday" },
];

const TIME_SIGNALS = [
  /ב?שעה\s+\d{1,2}(?::\d{2})?/u,
  /מחר|היום|עכשיו|הערב|הלילה|הבוקר|הצהריים/u,
  /ב?יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/u,
  /ב?\d{1,2}\/\d{1,2}/u,
  /בעוד\s+\d+\s+(?:דקות?|שעות?|ימים?)/u,
];

const EMOTIONAL_FRICTION_SIGNALS = [
  /לא רוצה|קשה לי|מפחד|חרדה|דוחה|לא יכול|עייף|שנוא|מעיק|כבד/u,
];

const VAGUE_TASK_WORDS = ["הפרויקט", "הדבר", "הענין", "זה", "הדברים", "הכל"];

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(text: string): InputIntentType {
  const t = text.toLowerCase();
  if (/תזכיר|תזכורת|remind/u.test(t)) return "create_reminder";
  if (/לקבוע|לתזמן|להוסיף פגישה|schedule/u.test(t)) return "schedule_event";
  if (/\?|מה |מי |איך |מתי |כמה |למה /u.test(t)) return "ask_question";
  if (/הרגשתי|בוצע|סיימתי|עדכון|מצב/u.test(t)) return "check_in";
  if (/אני אוהב|אני מעדיף|תמיד|לרוב|בדרך כלל/u.test(t)) return "express_preference";
  if (/תוסיף|תיצור|תפתח|צריך ל|רוצה ל|make|add|create/u.test(t)) return "create_task";
  if (/הקשר|מידע|לדעת|לסמן|לציין/u.test(t)) return "provide_context";
  return "unknown";
}

// ─── Person entity extraction ─────────────────────────────────────────────────

function extractPersonEntities(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  const seen = new Set<string>();

  // Pattern: "verb + preposition + Hebrew name(s)"
  const participantRe =
    /(?:לדבר עם|לשלוח ל|להתקשר ל|לפגוש את|פגישה עם|עם|אצל)\s+([א-ת]+(?:\s+[א-ת]+)?)/gu;

  let match: RegExpExecArray | null;
  while ((match = participantRe.exec(text)) !== null) {
    const rawMatch = match[1].trim();
    const words = rawMatch.split(/\s+/);
    // Strip trailing Hebrew stop word
    const name =
      words.length === 2 && HEBREW_STOP_SECOND_WORDS.has(words[1])
        ? words[0]
        : rawMatch;

    if (
      name.length > 1 &&
      !GENERIC_TASK_WORDS.has(name.toLowerCase()) &&
      !GENERIC_TASK_WORDS.has(name) &&
      !seen.has(name)
    ) {
      seen.add(name);
      entities.push({
        name,
        entityType: "person",
        isKnown: false,
        rawMatch,
      });
    }
  }

  return entities;
}

// ─── Time reference extraction ────────────────────────────────────────────────

function extractTimeReferences(text: string): TimeReference[] {
  const refs: TimeReference[] = [];

  for (const re of TIME_SIGNALS) {
    const m = re.exec(text);
    if (m) {
      const raw = m[0];
      refs.push({
        raw,
        type: /\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}/.test(raw) ? "absolute" : "relative",
        isDeadline: /עד|deadline|תאריך יעד/.test(text),
      });
    }
  }

  if (refs.length === 0 && /מתי|עד מתי/.test(text)) {
    refs.push({ raw: "?", type: "vague", isDeadline: true });
  }

  return refs;
}

// ─── Missing info detection ───────────────────────────────────────────────────

function detectMissingInfo(
  text: string,
  intent: InputIntentType,
  entities: DetectedEntity[],
  timeRefs: TimeReference[]
): MissingInfoKind[] {
  const missing: MissingInfoKind[] = [];

  // Unknown person referenced but no known entity
  const hasPersonSignal = PERSON_PREFIXES_HE.some(p => text.includes(p));
  if (hasPersonSignal && entities.filter(e => e.entityType === "person").length === 0) {
    missing.push("who");
  }

  // Vague object reference
  if (VAGUE_TASK_WORDS.some(w => text.includes(w))) {
    missing.push("which");
  }

  // No time reference for reminder/schedule
  if (
    (intent === "create_reminder" || intent === "schedule_event") &&
    timeRefs.length === 0
  ) {
    missing.push("when");
  }

  // Payment without target
  if (/לשלם|תשלום|חשבון|חוב/.test(text) && !/ל[^\s]+|ל-\S+/.test(text)) {
    missing.push("how_much");
  }

  // Vague task with no clear subject
  if (
    intent === "create_task" &&
    text.split(/\s+/).filter(w => w.length > 2).length < 3
  ) {
    missing.push("what");
  }

  return missing;
}

// ─── Urgency detection ────────────────────────────────────────────────────────

function detectUrgency(text: string): UrgencyLevel {
  for (const { re, level } of URGENCY_PATTERNS) {
    if (re.test(text)) return level;
  }
  return "unknown";
}

// ─── Ambiguity score ──────────────────────────────────────────────────────────

function calcAmbiguityScore(
  missingInfo: MissingInfoKind[],
  entities: DetectedEntity[],
  timeRefs: TimeReference[]
): number {
  let score = 0;
  score += missingInfo.length * 0.15;
  score += entities.filter(e => !e.isKnown).length * 0.1;
  score += timeRefs.filter(r => r.type === "vague").length * 0.1;
  return Math.min(1, score);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeInputContext(text: string): AnalyzedInputContext {
  const diagnostics: string[] = [];

  const intent = detectIntent(text);
  const urgency = detectUrgency(text);
  const entities = extractPersonEntities(text);
  const timeReferences = extractTimeReferences(text);
  const missingInfo = detectMissingInfo(text, intent, entities, timeReferences);
  const ambiguityScore = calcAmbiguityScore(missingInfo, entities, timeReferences);
  const emotionalFriction = EMOTIONAL_FRICTION_SIGNALS.some(re => re.test(text));
  const energyHint =
    /עייפות|כבד|אין כוח|מותש/.test(text)
      ? "low"
      : /אנרגיה|מוכן|ממוקד|מדויק/.test(text)
      ? "high"
      : "unknown";

  // Decide whether to create an Open Question
  const hasUnknownPerson = entities.some(e => e.entityType === "person" && !e.isKnown);
  const shouldCreateOpenQuestion =
    hasUnknownPerson || missingInfo.includes("which");

  // Decide whether to ask now vs. defer
  const requiresActionNow = urgency === "now" || urgency === "today";
  const criticalMissing =
    (intent === "create_reminder" && missingInfo.includes("when")) ||
    (missingInfo.includes("how_much") && /לשלם|חוב/.test(text));
  const shouldAskNow = criticalMissing;

  diagnostics.push(`intent=${intent}`);
  diagnostics.push(`urgency=${urgency}`);
  diagnostics.push(`entities=${entities.map(e => e.name).join(",") || "none"}`);
  diagnostics.push(`missing=${missingInfo.join(",") || "none"}`);
  diagnostics.push(`ambiguity=${ambiguityScore.toFixed(2)}`);

  return {
    originalText: text,
    intent,
    urgency,
    entities,
    timeReferences,
    missingInfo,
    ambiguityScore,
    requiresActionNow,
    shouldCreateOpenQuestion,
    shouldAskNow,
    energyHint,
    emotionalFriction,
    diagnostics,
  };
}

/**
 * Generate Open Question texts from an analyzed context.
 * Returns empty array if no questions are needed.
 * Caller is responsible for deduplication and persistence.
 */
export function generateOpenQuestionsFromContext(
  ctx: AnalyzedInputContext
): Array<{ questionText: string; questionType: string; relatedEntityName?: string }> {
  const questions: Array<{
    questionText: string;
    questionType: string;
    relatedEntityName?: string;
  }> = [];

  for (const entity of ctx.entities) {
    if (entity.entityType === "person" && !entity.isKnown) {
      questions.push({
        questionText: `מי זה ${entity.name} עבורך?`,
        questionType: "entity_identity",
        relatedEntityName: entity.name,
      });
    }
  }

  if (
    ctx.missingInfo.includes("which") &&
    ["create_task", "create_reminder", "schedule_event", "unknown"].includes(ctx.intent)
  ) {
    questions.push({
      questionText: "על איזה פרויקט התכוונת?",
      questionType: "project_identity",
    });
  }

  return questions;
}
