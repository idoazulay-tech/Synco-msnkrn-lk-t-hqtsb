/**
 * Synco Meaning Engine — Phase 8
 *
 * Extracts structured Signals from a RawEvent using deterministic heuristics.
 * No LLM calls. No DB calls. Pure function — fully testable.
 *
 * Input:  RawEvent
 * Output: MeaningEngineResult
 *
 * Hebrew is the primary content language.
 * Signal titles/summaries are English (internal).
 * Open questions are Hebrew (user-facing).
 *
 * Pipeline position:
 *   [RawEvent] → MeaningEngine → Signal[] → MemoryRouter
 */

import type { RawEvent } from '../types/rawEvent.js';
import { createSignal, type Signal, type SignalType, type SignalEntity } from '../types/signal.js';
import { defaultPrivacy, sensitivePrivacy } from '../types/privacy.js';
import { t } from '../localization/index.js';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface OpenQuestionSuggestion {
  questionText:      string;    // Hebrew user-facing question
  questionType:      string;
  relatedEntityName?: string;
  reason:            string;    // English internal reason
}

export interface SuggestedTask {
  title:    string;
  urgency:  'now' | 'today' | 'soon' | 'someday' | 'unknown';
  reason:   string;
}

export interface WikiUpdateHint {
  topic:     string;
  keyPoints: string[];
  reason:    string;
}

export interface GraphUpdateHint {
  nodeType: string;
  label:    string;
  relation?: { fromLabel: string; relationType: string };
  reason:   string;
}

export interface MeaningEngineResult {
  signals:           Signal[];
  openQuestions:     OpenQuestionSuggestion[];
  suggestedTasks:    SuggestedTask[];
  wikiUpdateHints:   WikiUpdateHint[];
  graphUpdateHints:  GraphUpdateHint[];
  diagnostics:       string[];
}

// ─── Hebrew pattern dictionaries ──────────────────────────────────────────────

const COMMITMENT_PATTERNS = [
  /אחזור|תחזור|אעשה|יעשה|אסיים|נסיים|אשלח|נשלח|אדבר|נדבר|אעמוד|נפגש|אפגש/u,
  /להחזיר|לחזור|לסיים|לשלוח|לדבר|לבצע|לעשות|לשלם|להעביר/u,
  /מחר|השבוע|בקרוב|בשעה|ביום/u,  // time + verb = commitment hint
];

const FINANCIAL_PATTERNS = [
  /כסף|תשלום|חשבון|חוב|הלוואה|אשראי|הוצאה|הכנסה|משכורת|שכר|עלות|תמחור/u,
  /שקל|ש"ח|₪|דולר|\$|אירו|€/u,
  /להחזיר כסף|החזר|לשלם|לשלם חזרה|חייב לי|חייבת לי|חייב ל|אני חייב/u,
  /הלוואות|חובות|ריבית|משכנתה|קרן/u,
];

const KNOWLEDGE_PATTERNS = [
  /קראתי|למדתי|ראיתי|שמעתי|גיליתי|הבנתי|ידעתי|נחשפתי|צפיתי/u,
  /מאמר|ספר|סרטון|פודקאסט|כתבה|נושא|תחום|תוכן/u,
  /מעניין|מרתק|חשוב לדעת|כדאי לדעת|שווה לזכור/u,
];

const EMOTIONAL_PATTERNS = [
  /קשה לי|לא רוצה|מפחד|חרדה|עצוב|מוטרד|עייף|מתוסכל|כועס|מאוכזב/u,
  /לא יכול|לא מסוגל|מרגיש|מלחיץ|לחץ|מעיק|כבד|נתקע/u,
];

const INTEREST_PATTERNS = [
  /מעניין אותי|רוצה ללמוד|מתעניין|סקרן|אני אוהב|אוהבת|נהנה|נהנית/u,
  /סרטונים על|מאמרים על|פודקאסט על|ספר על|קורס על/u,
];

const RISK_PATTERNS = [
  /בעיה|בעייתי|סיכון|אזהרה|מסוכן|לא בסדר|תקלה|כשל|נכשל|פחד|חשש/u,
];

// Person extractor — two patterns:
// 1. Attached preposition (no space): "לדני", "מדני", "עםדני" (rare)
const ATTACHED_PREP_RE = /(?:^|[\s,])ל([א-ת]{2,}(?:\s+[א-ת]{2,})?)/gu;
// 2. Separate preposition: "עם דני", "אצל דני", "פגישה עם דני"
const SEPARATE_PREP_RE = /(?:עם|אצל|לפגוש את|פגישה עם|להתקשר ל|לשלוח ל|לדבר עם)\s+([א-ת]{2,}(?:\s+[א-ת]{2,})?)/gu;

const GENERIC_WORDS = new Set([
  'אנשים', 'מישהו', 'מישהי', 'כולם', 'צוות', 'חברה', 'הבוס', 'הלקוח',
  'הצד', 'האחר', 'הם', 'הן', 'הוא', 'היא',
  // time words that regex captures as apparent names
  'מחר', 'היום', 'הערב', 'הלילה', 'הבוקר', 'עכשיו', 'בקרוב',
  // preposition-like words
  'גבי', 'דעת', 'פי', 'מנת',
  // task/project words
  'הפרויקט', 'המשימה', 'הדבר', 'הנושא', 'הדיון', 'הישיבה',
  // common Hebrew infinitives (ל + verb root — not names)
  'דבר', 'עשות', 'עשה', 'שלוח', 'שלם', 'אמר', 'קרוא', 'ידוע', 'בוא',
  'ראות', 'לכת', 'חזור', 'פנות', 'דון', 'בדוק', 'סיים', 'פתוח',
  'קבוע', 'תזמן', 'הוסיף', 'הזכיר', 'נסות', 'הכין', 'צור', 'פגוש',
  'התקשר', 'שאול', 'ענות', 'הגיש', 'עדכן', 'הכניס', 'הכנס',
]);

const RETURN_VERBS = /אחזור|אחזור אליך|תחזור|לחזור|להחזיר/u;

// ─── Signal extractors ────────────────────────────────────────────────────────

function extractCandidatesFromRe(re: RegExp, text: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // Take only the first word of the capture group (two-word names: future)
    const first = match[1].trim().split(/\s+/)[0];
    results.push(first);
  }
  return results;
}

function extractPersonEntities(text: string): SignalEntity[] {
  const found: SignalEntity[] = [];
  const seen = new Set<string>();

  const candidates = [
    ...extractCandidatesFromRe(new RegExp(ATTACHED_PREP_RE.source, 'gu'), text),
    ...extractCandidatesFromRe(new RegExp(SEPARATE_PREP_RE.source, 'gu'), text),
  ];

  for (const candidate of candidates) {
    if (candidate.length < 2) continue;
    if (GENERIC_WORDS.has(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    found.push({ name: candidate, entityType: 'person', isKnown: false });
  }
  return found;
}

function testAny(patterns: RegExp[], text: string): boolean {
  return patterns.some(p => p.test(text));
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runMeaningEngine(rawEvent: RawEvent): MeaningEngineResult {
  const text      = rawEvent.rawContent;
  const userId    = rawEvent.userId;
  const rawEventId = rawEvent.rawEventId;
  const diagnostics: string[] = [];
  const signals:    Signal[]  = [];
  const openQuestions: OpenQuestionSuggestion[] = [];
  const suggestedTasks: SuggestedTask[] = [];
  const wikiUpdateHints: WikiUpdateHint[] = [];
  const graphUpdateHints: GraphUpdateHint[] = [];

  diagnostics.push(`processing: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);

  // ── Persons ────────────────────────────────────────────────────────────────
  const personEntities = extractPersonEntities(text);
  for (const person of personEntities) {
    // Relationship signal for each detected person
    const relSig = createSignal(userId, 'relationship_signal',
      `person_mention:${person.name}`,
      `Person "${person.name}" mentioned in context`,
      {
        rawEventId,
        relatedEntities: [person],
        confidence: 0.7,
        evidenceSource: 'entity_presence',
        shouldUpdateGraph: true,
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(relSig);
    diagnostics.push(`relationship_signal: "${person.name}"`);

    // Graph update: create a person node
    graphUpdateHints.push({
      nodeType: 'person',
      label: person.name,
      reason: `mentioned in text: "${text.slice(0, 40)}"`,
    });

    // Open question if person is unknown
    if (!person.isKnown) {
      openQuestions.push({
        questionText: t.openQuestions.whoIsPerson(person.name),
        questionType: 'who_is_person',
        relatedEntityName: person.name,
        reason: `unknown person "${person.name}" detected`,
      });
      diagnostics.push(`open_question: who_is_person "${person.name}"`);
    }
  }

  // ── Commitment ─────────────────────────────────────────────────────────────
  if (testAny(COMMITMENT_PATTERNS, text)) {
    // Check for ambiguous "אחזור אליך" without clear target
    const hasReturnVerb = RETURN_VERBS.test(text);
    const hasNamedPerson = personEntities.length > 0;

    const commitSig = createSignal(userId, 'commitment_signal',
      'commitment_detected',
      `Commitment or follow-up detected in text`,
      {
        rawEventId,
        relatedEntities: personEntities,
        confidence: 0.75,
        evidenceSource: 'keyword_match',
        shouldCreateTask: true,
        shouldUpdateGraph: true,
        suggestedMemoryType: 'commitment',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(commitSig);
    diagnostics.push('commitment_signal detected');

    // Suggested task from commitment
    const urgency = /מחר/u.test(text) ? 'today' : /השבוע|בקרוב/u.test(text) ? 'soon' : 'unknown';
    suggestedTasks.push({
      title: text.slice(0, 60),
      urgency,
      reason: 'commitment language detected',
    });

    // If "I'll get back to you" without named person — open question
    if (hasReturnVerb && !hasNamedPerson) {
      openQuestions.push({
        questionText: 'למי בדיוק התכוונת לחזור?',
        questionType: 'missing_commitment_target',
        reason: 'return-verb without named target',
      });
      diagnostics.push('open_question: missing commitment target');
    }
  }

  // ── Financial ──────────────────────────────────────────────────────────────
  if (testAny(FINANCIAL_PATTERNS, text)) {
    const finSig = createSignal(userId, 'financial_signal',
      'financial_context_detected',
      `Financial context detected in text`,
      {
        rawEventId,
        relatedEntities: personEntities,
        confidence: 0.8,
        evidenceSource: 'keyword_match',
        shouldUpdateWiki: true,
        shouldUpdateGraph: true,
        suggestedMemoryType: 'commitment',
        privacy: sensitivePrivacy(userId),
      },
    );
    signals.push(finSig);
    diagnostics.push('financial_signal detected');

    wikiUpdateHints.push({
      topic: 'כלכלה',
      keyPoints: [`נזכר בהקשר פיננסי: "${text.slice(0, 60)}"`],
      reason: 'financial keyword detected',
    });

    graphUpdateHints.push({
      nodeType: 'financial_issue',
      label: 'הקשר פיננסי',
      reason: 'financial keywords in text',
    });
  }

  // ── Knowledge ──────────────────────────────────────────────────────────────
  if (testAny(KNOWLEDGE_PATTERNS, text)) {
    const knowSig = createSignal(userId, 'knowledge_signal',
      'knowledge_acquired',
      `User acquired or referenced knowledge`,
      {
        rawEventId,
        confidence: 0.7,
        evidenceSource: 'keyword_match',
        shouldUpdateWiki: true,
        suggestedMemoryType: 'knowledge',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(knowSig);
    diagnostics.push('knowledge_signal detected');

    wikiUpdateHints.push({
      topic: 'ידע כללי',
      keyPoints: [`משהו שנלמד: "${text.slice(0, 60)}"`],
      reason: 'knowledge keyword detected',
    });
  }

  // ── Interest ───────────────────────────────────────────────────────────────
  if (testAny(INTEREST_PATTERNS, text)) {
    const interestSig = createSignal(userId, 'interest_signal',
      'interest_detected',
      `User expressed interest in a topic`,
      {
        rawEventId,
        confidence: 0.65,
        evidenceSource: 'keyword_match',
        shouldUpdateWiki: true,
        suggestedMemoryType: 'knowledge',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(interestSig);
    diagnostics.push('interest_signal detected');
  }

  // ── Emotional ──────────────────────────────────────────────────────────────
  if (testAny(EMOTIONAL_PATTERNS, text)) {
    const emotSig = createSignal(userId, 'emotional_signal',
      'emotional_friction',
      `Emotional friction or difficulty detected`,
      {
        rawEventId,
        confidence: 0.7,
        evidenceSource: 'keyword_match',
        shouldCreateOpenQuestion: true,
        suggestedMemoryType: 'behavioral',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(emotSig);
    diagnostics.push('emotional_signal detected');
  }

  // ── Risk ───────────────────────────────────────────────────────────────────
  if (testAny(RISK_PATTERNS, text)) {
    const riskSig = createSignal(userId, 'risk_signal',
      'risk_detected',
      `Risk or problem context detected`,
      {
        rawEventId,
        confidence: 0.6,
        evidenceSource: 'keyword_match',
        suggestedMemoryType: 'episodic',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(riskSig);
    diagnostics.push('risk_signal detected');
  }

  // ── Generic task signal — always if nothing else matched ───────────────────
  if (signals.length === 0) {
    const taskSig = createSignal(userId, 'task_signal',
      'generic_task',
      `Generic task or note detected`,
      {
        rawEventId,
        confidence: 0.5,
        evidenceSource: 'context_inference',
        shouldCreateTask: true,
        suggestedMemoryType: 'episodic',
        privacy: defaultPrivacy(userId),
      },
    );
    signals.push(taskSig);
    diagnostics.push('task_signal: fallback (no specific signal matched)');
  }

  diagnostics.push(`total signals: ${signals.length}, open questions: ${openQuestions.length}`);

  return {
    signals,
    openQuestions,
    suggestedTasks,
    wikiUpdateHints,
    graphUpdateHints,
    diagnostics,
  };
}
