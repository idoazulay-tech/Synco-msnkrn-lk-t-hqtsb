/**
 * intakeDeterministicParser.ts
 *
 * Smart domain-aware deterministic parser for Hebrew free-text intake.
 * Pure functions only — no Prisma, no AI, fully testable without mocks.
 *
 * Architecture:
 *  1. Segment the raw text (not just by comma — preserve connective context)
 *  2. Classify each segment: emotional | person_action | actionable | domain_noun | overload
 *  3. Group domain words into projects
 *  4. Convert bare nouns into actionable first steps
 *  5. Select exactly one nowAction
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SyncoNowAction {
  title: string;
  firstStep: string;
  duration: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  confidence: number;
  linkedProjectTempId?: string;
  source: 'intake';
}

export interface SyncoTodayTask {
  title: string;
  firstStep?: string;
  duration?: number;
  priority?: 'high' | 'medium' | 'low';
  reason?: string;
  linkedProjectTempId?: string;
}

export interface SyncoLaterTask {
  title: string;
  firstStep?: string;
  reason?: string;
  linkedProjectTempId?: string;
}

export interface SyncoProjectStep {
  title: string;
  orderIndex: number;
  suggestedDuration?: number;
  status: 'pending';
}

export interface SyncoProject {
  tempId: string;
  title: string;
  goal: string;
  priority?: 'high' | 'medium' | 'low';
  reason: string;
  firstActionTitle: string;
  steps: SyncoProjectStep[];
}

export interface SyncoOpenQuestion {
  question: string;
  reason: string;
  blocksScheduling: boolean;
}

export interface SyncoNote {
  text: string;
  reason: string;
  category?: 'concern' | 'emotion' | 'context' | 'memory' | 'overload';
}

export interface SyncoEntities {
  people: string[];
  places: string[];
  times: string[];
  dates: string[];
  priorities: string[];
  topics: string[];
  emotions: string[];
}

export interface SyncoIntakePreview {
  nowAction: SyncoNowAction | null;
  todayTasks: SyncoTodayTask[];
  laterTasks: SyncoLaterTask[];
  projects: SyncoProject[];
  openQuestions: SyncoOpenQuestion[];
  notes: SyncoNote[];
  entities: SyncoEntities;
  warnings: string[];
}

// ─── Domain knowledge ─────────────────────────────────────────────────────────

const FINANCE_ROOTS = new Set([
  'בנק', 'שכירות', 'שכר', 'חוב', 'חובות', 'כסף', 'תשלום', 'תשלומים',
  'משכנתא', 'אשראי', 'הלוואה', 'ביטוח', 'מינוס', 'חשבון', 'חשבונות',
  'קרן', 'ריבית', 'חשבון בנק', 'פוליסה', 'כרטיס', 'קרן השתלמות',
]);

const SYNCO_ROOTS = new Set([
  'סינקו', 'synco', 'icp', 'ולידציה', 'validation', 'מוצר', 'product',
  'לקוחות', 'b2b', 'mvp', 'פיבוט', 'pivot', 'ראנדר', 'runway',
  'go to market', 'גו טו מרקט', 'landing', 'לנדינג', 'ולידציות',
]);

const HOUSE_ROOTS = new Set([
  'כביסה', 'ניקיון', 'קניות', 'פח', 'כלים', 'מדיח', 'מכונה', 'מטבח',
  'אוכל', 'סופרמרקט', 'מכולת', 'ריצפה', 'אבק', 'חדר', 'שירותים',
]);

const HEALTH_ROOTS = new Set([
  'רופא', 'ספורט', 'שינה', 'בריאות', 'תרופות', 'בדיקות', 'קופת חולים',
  'הליכה', 'ריצה', 'מדיטציה', 'אימון',
]);

const WORK_ROOTS = new Set([
  'מייל', 'ישיבה', 'פגישה', 'דוח', 'מצגת', 'חוזה', 'לקוח', 'פרוייקט',
  'דדליין', 'קוד', 'קידוד', 'PR', 'ריביו', 'review',
]);

type DomainKey = 'finance' | 'synco' | 'house' | 'health' | 'work';

const DOMAIN_MAP: Record<DomainKey, Set<string>> = {
  finance: FINANCE_ROOTS,
  synco:   SYNCO_ROOTS,
  house:   HOUSE_ROOTS,
  health:  HEALTH_ROOTS,
  work:    WORK_ROOTS,
};

// ─── Emotional / overload phrases ─────────────────────────────────────────────

const EMOTIONAL_PATTERNS: RegExp[] = [
  /^אני מוצף/i,
  /^מוצף/i,
  /לא יודע מה לעשות/i,
  /לא יודע מה קודם/i,
  /מבולבל/i,
  /^לחוץ/i,
  /^אני לחוץ/i,
  /קשה לי/i,
  /^אני עייף/i,
  /^עייף/i,
  /לא מסוגל/i,
  /מרגיש מוצף/i,
  /^המוח שלי/i,
  /^ראשי מלא/i,
  /^ראש עמוס/i,
];

const OVERLOAD_PATTERNS: RegExp[] = [
  /לא יודע מה לעשות קודם/i,
  /לא יודע מה ראשון/i,
  /לא יודע איפה להתחיל/i,
  /לא יודע מאיפה להתחיל/i,
  /יותר מדי דברים/i,
  /כל כך הרבה דברים/i,
  /לא יודע מה לעשות/i,
];

// ─── Person contact patterns ──────────────────────────────────────────────────

const PERSON_ACTION_PATTERNS: RegExp[] = [
  /^לדבר\s+עם\s+(.+)/i,
  /^להתקשר\s+ל(?:ל)?(.+)/i,
  /^לפגוש\s+(?:את\s+)?(.+)/i,
  /^שיחה\s+עם\s+(.+)/i,
  /^לשלוח\s+ל(?:ל)?(.+)/i,
  /^לשלוח\s+מייל\s+ל(?:ל)?(.+)/i,
  /^לכתוב\s+ל(?:ל)?(.+)/i,
];

// ─── Actionable verb prefixes (starts with these = it's actionable) ───────────

const ACTION_VERBS = [
  'לבדוק', 'לשלוח', 'לקנות', 'לכתוב', 'לקרוא', 'לסיים', 'לעשות',
  'לסדר', 'לנקות', 'לבשל', 'לקבוע', 'לתאם', 'להגיש', 'להתקשר',
  'לרשום', 'לעדכן', 'לפתוח', 'לסגור', 'להוריד', 'להעלות', 'לבנות',
  'לפתח', 'ליצור', 'לתכנן', 'לשפר', 'לנסות', 'להשלים', 'לאשר',
  'לחדש', 'לבטל', 'לדחות', 'להזמין', 'לגבות', 'לשלם', 'לקבל',
];

// ─── Segment classifier ───────────────────────────────────────────────────────

type SegmentClass =
  | { type: 'emotional'; emotion: string }
  | { type: 'overload'; text: string }
  | { type: 'person_action'; title: string; person: string }
  | { type: 'actionable'; title: string; domain?: DomainKey; topic?: string }
  | { type: 'domain_noun'; domain: DomainKey; root: string; original: string }
  | { type: 'project_keyword'; title: string }
  | { type: 'unknown'; text: string };

function stripHebrewArticle(word: string): string {
  const lower = word.toLowerCase();
  // Strip 2-char prefixes first (מה, מב, מל, בה, לה, שה, כה, וה)
  const two = ['מה', 'מב', 'מל', 'מכ', 'בה', 'לה', 'שה', 'כה', 'וה'];
  for (const p of two) {
    if (lower.startsWith(p) && lower.length > p.length + 1) {
      const stripped = lower.slice(p.length);
      if (stripped.length > 1) return stripped;
    }
  }
  // Strip single-char prefixes
  const one = ['ה', 'ב', 'ל', 'מ', 'ו', 'כ', 'ש'];
  for (const p of one) {
    if (lower.startsWith(p) && lower.length > p.length + 1) {
      const stripped = lower.slice(p.length);
      if (stripped.length > 1) return stripped;
    }
  }
  return lower;
}

function detectDomain(word: string): DomainKey | undefined {
  const variants = [word.toLowerCase(), stripHebrewArticle(word)];
  for (const [key, set] of Object.entries(DOMAIN_MAP) as [DomainKey, Set<string>][]) {
    for (const v of variants) {
      if (set.has(v)) return key;
    }
  }
  return undefined;
}

function isActionableVerb(segment: string): boolean {
  const trimmed = segment.trim().toLowerCase();
  return ACTION_VERBS.some(v => trimmed.startsWith(v));
}

function isNounOnly(segment: string): boolean {
  const trimmed = segment.trim();
  // A noun segment is short, has no action verb prefix, no "עם"/"ל"/"אל" preposition
  if (trimmed.length > 30) return false;
  if (isActionableVerb(trimmed)) return false;
  if (/\s+(עם|עמה|עמו|אל|ל)\s+/.test(trimmed)) return false;
  // Has no spaces (single word) or is 2 words at most
  const words = trimmed.split(/\s+/);
  if (words.length <= 2) return true;
  return false;
}

function classifySegment(raw: string): SegmentClass {
  const seg = raw.trim();
  if (!seg) return { type: 'unknown', text: seg };

  // Strip leading ו (connective "and") before classification
  const s = seg.replace(/^ו(?=[א-ת])/, '').trim();

  // 1. Overload patterns (check before emotional — more specific)
  for (const pattern of OVERLOAD_PATTERNS) {
    if (pattern.test(s)) {
      return { type: 'overload', text: s };
    }
  }

  // 2. Emotional patterns
  for (const pattern of EMOTIONAL_PATTERNS) {
    if (pattern.test(s)) {
      // Try to extract a topic from the emotional phrase (e.g. "אני מוצף מהבנק" → בנק)
      return { type: 'emotional', emotion: extractEmotionCore(s) };
    }
  }

  // 3. Person action patterns
  for (const pattern of PERSON_ACTION_PATTERNS) {
    const m = s.match(pattern);
    if (m) {
      const person = m[1].trim().split(/\s+/)[0]; // First word after "עם" / "ל"
      return { type: 'person_action', title: s, person };
    }
  }

  // 4. Actionable verb
  if (isActionableVerb(s)) {
    const domain = detectDomainFromText(s);
    const topic = extractTopicFromAction(s);
    return { type: 'actionable', title: s, domain, topic };
  }

  // 5. Domain noun (bare noun in a known domain)
  const domain = detectDomainFromText(s);
  if (domain && isNounOnly(s)) {
    const root = stripHebrewArticle(s.split(/\s+/)[0]);
    return { type: 'domain_noun', domain, root, original: s };
  }

  // 6. Short project-signaling phrase
  if (/^(פרויקט|מיזם|תוכנית|לבנות|לפתח)/i.test(s)) {
    return { type: 'project_keyword', title: s };
  }

  // 7. Unknown — might be a later task or context
  return { type: 'unknown', text: s };
}

function detectDomainFromText(text: string): DomainKey | undefined {
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    const d = detectDomain(word);
    if (d) return d;
  }
  return undefined;
}

function extractTopicFromAction(text: string): string | undefined {
  // "לבדוק ICP" → "ICP"
  // "לשלם משכנתא" → "משכנתא"
  const words = text.trim().split(/\s+/);
  if (words.length >= 2) return words.slice(1).join(' ');
  return undefined;
}

function extractEmotionCore(s: string): string {
  // "אני מוצף מהבנק" → "מוצף"
  const m = s.match(/(מוצף|לחוץ|מבולבל|עייף|מרוגז|מתוח|מפחד|חרד|עצוב|מוכן)/i);
  if (m) return m[1];
  return s.slice(0, 50);
}

// ─── Project step templates ───────────────────────────────────────────────────

const DOMAIN_PROJECT_TEMPLATES: Record<DomainKey, {
  title: string;
  goal: string;
  reason: string;
  firstActionTitle: string;
  steps: Omit<SyncoProjectStep, 'orderIndex'>[];
}> = {
  finance: {
    title:           'סידור בנק וחובות',
    goal:            'לקבל תמונה מלאה של המצב הפיננסי ולתכנן החזרים ריאליים',
    reason:          'יש כמה נושאים פיננסיים פתוחים שמייצרים עומס קוגניטיבי — כדאי לסדר אותם ביחד',
    firstActionTitle:'לרשום את כל החובות והסכומים',
    steps: [
      { title: 'לרשום את כל החובות והסכומים', suggestedDuration: 30, status: 'pending' },
      { title: 'לבדוק מצב חשבון הבנק והמינוס הנוכחי', suggestedDuration: 15, status: 'pending' },
      { title: 'לברר מתי השכירות הקרובה ומה חסר לתשלום', suggestedDuration: 20, status: 'pending' },
      { title: 'לדרג את החובות לפי דחיפות ותאריך יעד', suggestedDuration: 20, status: 'pending' },
      { title: 'לתכנן תשלומים ריאליים לפי תזרים', suggestedDuration: 30, status: 'pending' },
    ],
  },
  synco: {
    title:           'קידום סינקו',
    goal:            'להגיע ל-PMF ראשוני דרך ולידציה מהירה עם לקוחות פוטנציאליים',
    reason:          'סינקו ו-ICP הוזכרו — יש עבודת מוצר ושיווק שצריכה מיקוד',
    firstActionTitle:'לבדוק ICP ולהגדיר פרסונה ברורה',
    steps: [
      { title: 'לבדוק ICP ולהגדיר פרסונה ברורה', suggestedDuration: 45, status: 'pending' },
      { title: 'לרשום 5 לקוחות פוטנציאליים ולהתחיל שיחה', suggestedDuration: 30, status: 'pending' },
      { title: 'לקיים שיחות ולידציה עם לפחות 2 אנשים', suggestedDuration: 60, status: 'pending' },
      { title: 'לעדכן roadmap על בסיס פידבק', suggestedDuration: 30, status: 'pending' },
      { title: 'לקבוע מטרה מדידה לחודש הקרוב', suggestedDuration: 20, status: 'pending' },
    ],
  },
  house: {
    title:           'משימות הבית',
    goal:            'לשמור על בית מסודר ונקי עם שגרה ברורה',
    reason:          'משימות בית שהצטברו — כדאי לסדר אותן בבת אחת',
    firstActionTitle:'לרשום את כל משימות הבית שנשארו פתוחות',
    steps: [
      { title: 'לאסוף כביסה ולהפריד לסוגים', suggestedDuration: 10, status: 'pending' },
      { title: 'להכניס כביסה למכונה', suggestedDuration: 5, status: 'pending' },
      { title: 'לנקות משטחים ולנגב רצפה', suggestedDuration: 20, status: 'pending' },
      { title: 'קניות שבועיות ברשימה', suggestedDuration: 45, status: 'pending' },
      { title: 'לאחסן כביסה יבשה', suggestedDuration: 15, status: 'pending' },
    ],
  },
  health: {
    title:           'בריאות ושגרה',
    goal:            'לשמור על שגרה בריאה — שינה, תנועה, בדיקות',
    reason:          'נושאי בריאות שעלו — כדאי לתת להם מקום מסודר',
    firstActionTitle:'לבדוק מה הבדיקות שצריך לקבוע אצל הרופא',
    steps: [
      { title: 'לבדוק מה הבדיקות שצריך לקבוע', suggestedDuration: 10, status: 'pending' },
      { title: 'לקבוע תור לרופא', suggestedDuration: 10, status: 'pending' },
      { title: 'להכניס אימון שבועי לאפליקציה', suggestedDuration: 15, status: 'pending' },
      { title: 'לוודא שעת שינה קבועה', suggestedDuration: 5, status: 'pending' },
    ],
  },
  work: {
    title:           'משימות עבודה',
    goal:            'לנקות את צבר המשימות המקצועיות',
    reason:          'משימות עבודה שעלו — כדאי לסדר לפי עדיפות',
    firstActionTitle:'לרשום את כל המשימות הפתוחות בעבודה',
    steps: [
      { title: 'לרשום את כל המשימות הפתוחות בעבודה', suggestedDuration: 20, status: 'pending' },
      { title: 'לדרג לפי עדיפות ודדליין', suggestedDuration: 15, status: 'pending' },
      { title: 'לטפל במשימה הדחופה ביותר', suggestedDuration: 60, status: 'pending' },
      { title: 'לשלוח עדכון לצד הרלוונטי', suggestedDuration: 15, status: 'pending' },
    ],
  },
};

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseIntakeDeterministic(text: string): SyncoIntakePreview {
  if (!text || !text.trim()) {
    return emptyPreview();
  }

  const raw = text.trim();

  // Split on comma, semicolon, newline — but not inside quotes
  const rawSegments = raw
    .split(/[,،;\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const classified = rawSegments.map(classifySegment);

  const notes: SyncoNote[] = [];
  const todayTasks: SyncoTodayTask[] = [];
  const people: string[] = [];
  const topicSet = new Set<string>();
  const emotionSet = new Set<string>();
  const detectedDomains = new Set<DomainKey>();
  const domainNouns: Map<DomainKey, string[]> = new Map();
  const unknownSegments: string[] = [];

  // Pass 1: classify everything
  for (const cls of classified) {
    switch (cls.type) {
      case 'emotional': {
        emotionSet.add(cls.emotion);
        // Extract any domain words embedded in the emotional phrase
        const d = detectDomainFromText(cls.emotion);
        if (d) detectedDomains.add(d);
        notes.push({
          text: cls.emotion,
          reason: 'הביטוי מעיד על עומס רגשי — נשמר כהקשר ולא כמשימה',
          category: 'emotion',
        });
        break;
      }
      case 'overload': {
        notes.push({
          text: cls.text,
          reason: 'תחושת מוצף ובלבול בסדר עדיפויות — בדיוק בשביל זה אנחנו מסדרים',
          category: 'overload',
        });
        break;
      }
      case 'person_action': {
        people.push(cls.person);
        todayTasks.push({
          title: cls.title,
          priority: 'medium',
          reason: `שיחה עם ${cls.person}`,
        });
        break;
      }
      case 'actionable': {
        if (cls.domain) detectedDomains.add(cls.domain);
        if (cls.topic) topicSet.add(cls.topic);
        todayTasks.push({
          title: cls.title,
          priority: 'medium',
          ...(cls.domain ? { linkedProjectTempId: `proj_${cls.domain}` } : {}),
        });
        break;
      }
      case 'domain_noun': {
        detectedDomains.add(cls.domain);
        topicSet.add(cls.root);
        if (!domainNouns.has(cls.domain)) domainNouns.set(cls.domain, []);
        domainNouns.get(cls.domain)!.push(cls.original);
        break;
      }
      case 'project_keyword': {
        // Will be handled as a standalone project if needed
        unknownSegments.push(cls.title);
        break;
      }
      case 'unknown': {
        unknownSegments.push(cls.text);
        break;
      }
    }
  }

  // Also scan the full text for domain words that may not be isolated segments
  // Strip trailing punctuation so "מהבנק," correctly resolves to "בנק"
  for (const word of raw.split(/\s+/)) {
    const cleanWord = word.replace(/[,،;.!?""״]+$/, '');
    const d = detectDomain(cleanWord);
    if (d) {
      detectedDomains.add(d);
      topicSet.add(stripHebrewArticle(cleanWord));
    }
  }

  // Pass 2: extract topics from emotional segments (e.g. "אני מוצף מהבנק" → בנק is finance)
  for (const seg of rawSegments) {
    const words = seg.split(/\s+/);
    for (const w of words) {
      const cleanW = w.replace(/[,،;.!?""״]+$/, '');
      const d = detectDomain(cleanW);
      if (d) {
        detectedDomains.add(d);
        topicSet.add(stripHebrewArticle(cleanW));
      }
    }
  }

  // Build projects from detected domains (finance first, then synco, then others)
  const projects: SyncoProject[] = [];
  const domainOrder: DomainKey[] = ['finance', 'synco', 'house', 'work', 'health'];

  for (const domain of domainOrder) {
    if (!detectedDomains.has(domain)) continue;

    const tmpl = DOMAIN_PROJECT_TEMPLATES[domain];
    const tempId = `proj_${domain}`;

    // Incorporate domain noun mentions into step notes
    const extra = domainNouns.get(domain) ?? [];
    const steps = tmpl.steps.map((s, i) => ({ ...s, orderIndex: i }));

    // Add extra noun-derived steps if they suggest something specific
    for (const noun of extra) {
      const nounRoot = stripHebrewArticle(noun.split(/\s+/)[0]);
      if (DOMAIN_PRIMARY_NOUNS[domain]?.has(nounRoot)) continue; // skip generic domain identifier
      const actionized = nounToAction(noun, domain);
      if (actionized && !steps.some(s => s.title === actionized)) {
        steps.push({ title: actionized, orderIndex: steps.length, status: 'pending' });
      }
    }

    projects.push({
      tempId,
      title: tmpl.title,
      goal: tmpl.goal,
      priority: domain === 'finance' ? 'high' : 'medium',
      reason: tmpl.reason,
      firstActionTitle: tmpl.firstActionTitle,
      steps: steps.slice(0, 7), // max 7 steps
    });

    // Link today tasks to this project
    for (const t of todayTasks) {
      if (!t.linkedProjectTempId && t.title && detectDomainFromText(t.title) === domain) {
        t.linkedProjectTempId = tempId;
      }
    }
  }

  // Link unlinked person-contact tasks to Synco when Synco is in context.
  // "לדבר עם X" has no domain signal in its title, but in a Synco/ICP intake
  // it almost always represents a validation or outreach call.
  if (detectedDomains.has('synco')) {
    for (const t of todayTasks) {
      if (!t.linkedProjectTempId && t.title) {
        if (PERSON_ACTION_PATTERNS.some(p => p.test(t.title))) {
          t.linkedProjectTempId = 'proj_synco';
        }
      }
    }
  }

  // Pass 3: unknown segments → laterTasks or openQuestions
  const openQuestions: SyncoOpenQuestion[] = [];
  const laterTasks: SyncoLaterTask[] = [];

  for (const seg of unknownSegments) {
    if (seg.length < 3) continue;
    if (seg.length > 5) {
      laterTasks.push({
        title: seg,
        reason: 'לא ניתן היה לסווג — שמור לבדיקה ידנית',
      });
    }
  }

  // Pass 4: select nowAction
  const nowAction = selectNowAction(todayTasks, projects, detectedDomains);

  // Build entities
  const entities: SyncoEntities = {
    people:    [...new Set(people)],
    places:    [],
    times:     [],
    dates:     [],
    priorities: [],
    topics:    [...topicSet].filter(t => t.length > 1),
    emotions:  [...emotionSet],
  };

  const warnings: string[] = [];
  if (projects.length === 0 && todayTasks.length === 0 && laterTasks.length === 0) {
    warnings.push('לא זוהו משימות ברורות בטקסט');
  }

  return {
    nowAction,
    todayTasks,
    laterTasks,
    projects,
    openQuestions,
    notes,
    entities,
    warnings,
  };
}

// ─── Noun → actionable conversion ────────────────────────────────────────────

const NOUN_TO_ACTION: Record<string, string> = {
  // finance
  'שכירות':  'לברר מתי השכירות הקרובה ומה חסר לתשלום',
  'חובות':   'לרשום את כל החובות והסכומים',
  'חוב':     'לרשום את כל החובות והסכומים',
  'בנק':     'לבדוק מצב חשבון הבנק',
  'אשראי':   'לבדוק מצב כרטיסי האשראי',
  'משכנתא':  'לבדוק מצב ההחזר החודשי של המשכנתא',
  'ביטוח':   'לבדוק מה הביטוחים הפעילים ואם אפשר לחסוך',
  // house
  'כביסה':   'לאסוף כביסה, להפריד ולהכניס למכונה',
  'ניקיון':  'לנקות את הבית — משטחים, רצפה, שירותים',
  'קניות':   'לעשות קניות שבועיות לפי רשימה',
  // health
  'רופא':    'לקבוע תור לרופא',
  'בדיקות':  'לברר אילו בדיקות צריך לקבוע',
};

// Nouns that ARE the domain itself — skip generic fallback action for them
const DOMAIN_PRIMARY_NOUNS: Partial<Record<DomainKey, Set<string>>> = {
  synco:   new Set(['סינקו', 'synco']),
  finance: new Set(['בנק', 'כסף', 'bank']),
  house:   new Set(['בית', 'house']),
};

function nounToAction(noun: string, domain: DomainKey): string | undefined {
  const root = stripHebrewArticle(noun.split(/\s+/)[0]);
  if (NOUN_TO_ACTION[root]) return NOUN_TO_ACTION[root];
  if (NOUN_TO_ACTION[noun.toLowerCase()]) return NOUN_TO_ACTION[noun.toLowerCase()];
  // Fallback: generic action based on domain
  const domainVerb: Record<DomainKey, string> = {
    finance: 'לסדר',
    synco:   'לטפל ב',
    house:   'לסדר את',
    health:  'לטפל ב',
    work:    'לטפל ב',
  };
  return `${domainVerb[domain]} ${noun}`;
}

// ─── nowAction selection ──────────────────────────────────────────────────────

function selectNowAction(
  todayTasks: SyncoTodayTask[],
  projects: SyncoProject[],
  detectedDomains: Set<DomainKey>,
): SyncoNowAction | null {
  // Prefer finance project first step if finance detected (overload often finance-related)
  if (detectedDomains.has('finance') && projects.length > 0) {
    const financeProj = projects.find(p => p.tempId === 'proj_finance');
    if (financeProj) {
      return {
        title:               financeProj.firstActionTitle,
        firstStep:           'לפתוח מסמך חדש (או דף נייר) ולרשום כל חוב עם הסכום המדויק',
        duration:            30,
        priority:            'high',
        reason:              'רישום כל החובות מפנה את הראש ומאפשר תכנון ריאלי — הצעד הכי חשוב עכשיו',
        confidence:          0.85,
        linkedProjectTempId: financeProj.tempId,
        source:              'intake',
      };
    }
  }

  // Next: prefer a concrete todayTask (person contact or check action)
  const concreteTodayTask = todayTasks.find(
    t => t.title && !isEmotionalPhrase(t.title) && t.title.length > 3,
  );
  if (concreteTodayTask) {
    return {
      title:               concreteTodayTask.title,
      firstStep:           `להתחיל: ${concreteTodayTask.title}`,
      duration:            concreteTodayTask.duration ?? 20,
      priority:            concreteTodayTask.priority ?? 'medium',
      reason:              'פעולה קצרה וברורה שאפשר לעשות מיד',
      confidence:          0.75,
      linkedProjectTempId: concreteTodayTask.linkedProjectTempId,
      source:              'intake',
    };
  }

  // Fallback: first step of first project
  if (projects.length > 0) {
    const proj = projects[0];
    return {
      title:               proj.firstActionTitle,
      firstStep:           proj.steps[0]?.title ?? proj.firstActionTitle,
      duration:            proj.steps[0]?.suggestedDuration ?? 30,
      priority:            proj.priority ?? 'medium',
      reason:              `הצעד הראשון לפרויקט "${proj.title}"`,
      confidence:          0.7,
      linkedProjectTempId: proj.tempId,
      source:              'intake',
    };
  }

  return null;
}

function isEmotionalPhrase(text: string): boolean {
  return EMOTIONAL_PATTERNS.some(p => p.test(text)) ||
    OVERLOAD_PATTERNS.some(p => p.test(text));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyPreview(): SyncoIntakePreview {
  return {
    nowAction:     null,
    todayTasks:    [],
    laterTasks:    [],
    projects:      [],
    openQuestions: [],
    notes:         [],
    entities:      { people: [], places: [], times: [], dates: [], priorities: [], topics: [], emotions: [] },
    warnings:      ['הטקסט ריק — נא להזין תוכן'],
  };
}

// ─── Legacy shim (for backward compat with intakeClassifier imports) ──────────

export type IntakeType = 'single_task' | 'multi_task' | 'project';

export interface IntakePreview {
  type: IntakeType;
  rawText: string;
  tasks: { title: string; priority?: 'high' | 'medium' | 'low' }[];
  project?: { title: string; goalText?: string; steps: { title: string; orderIndex: number }[] };
  openQuestions: string[];
}

/** @deprecated Use parseIntakeDeterministic() instead */
export function buildIntakePreview(rawText: string): IntakePreview {
  const preview = parseIntakeDeterministic(rawText);
  return {
    type: preview.projects.length > 0 ? 'project' : preview.todayTasks.length > 1 ? 'multi_task' : 'single_task',
    rawText,
    tasks: preview.todayTasks.map(t => ({ title: t.title, priority: t.priority })),
    project: preview.projects[0]
      ? {
          title:    preview.projects[0].title,
          goalText: preview.projects[0].goal,
          steps:    preview.projects[0].steps.map(s => ({ title: s.title, orderIndex: s.orderIndex })),
        }
      : undefined,
    openQuestions: preview.openQuestions.map(q => q.question),
  };
}
