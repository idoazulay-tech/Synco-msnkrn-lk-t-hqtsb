/**
 * planningAnchorContextService.ts
 *
 * Anchor-Aware Scheduling Context — Stage 3ב.1
 * מזהה אירועי עוגן (יציאה, פגישה, נסיעה…) ומשימות הכנה הקשורות אליהם.
 * מחזיר הקשר עם schedulingContextReasons ייחודיות לכל משימה.
 *
 * מבודד לחלוטין: לא נוגע ב-schedulePlanner, buildSchedule, DB, Auth.
 * לא מ-mutate tasks.
 */

// ── מילות מפתח ──────────────────────────────────────────────────────────────

const ANCHOR_KEYWORDS: string[] = [
  'יציאה', 'נסיעה', 'פגישה', 'תור', 'אימון', 'אירוע',
  'להגיע', 'לצאת', 'טיסה', 'רכבת',
];

const PREP_KEYWORDS: string[] = [
  'לפני', 'לקראת', 'להכין', 'לארגן', 'תיק',
  'להעיר', 'להחליט', 'לבדוק', 'לקחת', 'לזכור',
  'להביא', 'קיטו', 'שני', 'נסיעה', 'יציאה',
];

// מילות מפתח לפי קבוצת "שם מקום / ישות משותפת"
const SHARED_ENTITY_KEYWORDS: string[] = [
  'יהוד', 'תל אביב', 'ירושלים', 'חיפה', 'ראשל"צ', 'ראשון לציון',
  'שני', 'קיטו', 'אמא', 'אבא',
  'יציאה', 'נסיעה', 'פגישה',
];

// ── טיפוסים ─────────────────────────────────────────────────────────────────

export type RelationType =
  | 'before_departure'
  | 'prepare_for_event'
  | 'decision_before_event'
  | 'reminder_before_event'
  | 'related_context';

export interface AnchorTask {
  taskId: string;
  title: string;
  startTime: string; // ISO string
  anchorType: string;
  keywords: string[];
}

export interface PreparationLink {
  taskId: string;
  anchorTaskId: string;
  relationType: RelationType;
  suggestedLatestEndIso: string; // should finish before anchor
  reason: string;
}

export interface AnchorContext {
  anchors: AnchorTask[];
  preparationLinks: PreparationLink[];
  warnings: string[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function extractKeywords(title: string, keywords: string[]): string[] {
  return keywords.filter(kw => title.includes(kw));
}

function getStartTimeIso(task: Record<string, any>): string | null {
  const raw = task.startTime;
  if (!raw) return null;
  return raw instanceof Date ? raw.toISOString() : String(raw);
}

function isAnchorTask(task: Record<string, any>): boolean {
  const title = task.title ?? '';
  const hasKeyword = ANCHOR_KEYWORDS.some(kw => title.includes(kw));
  const hasTime = !!getStartTimeIso(task);
  return hasKeyword && hasTime;
}

function isPrepTask(task: Record<string, any>): boolean {
  const title = task.title ?? '';
  return PREP_KEYWORDS.some(kw => title.includes(kw));
}

function detectAnchorType(title: string): string {
  if (title.includes('יציאה') || title.includes('לצאת')) return 'departure';
  if (title.includes('נסיעה') || title.includes('רכבת') || title.includes('טיסה')) return 'travel';
  if (title.includes('פגישה')) return 'meeting';
  if (title.includes('תור')) return 'appointment';
  if (title.includes('אימון')) return 'workout';
  if (title.includes('אירוע')) return 'event';
  if (title.includes('להגיע')) return 'arrival';
  return 'general';
}

function detectRelationType(prepTitle: string): RelationType {
  if (prepTitle.includes('להחליט') || prepTitle.includes('לבדוק')) return 'decision_before_event';
  if (prepTitle.includes('להעיר') || prepTitle.includes('לזכור')) return 'reminder_before_event';
  if (prepTitle.includes('להכין') || prepTitle.includes('לארגן') || prepTitle.includes('תיק')) return 'prepare_for_event';
  if (prepTitle.includes('לפני') || prepTitle.includes('לקראת')) return 'before_departure';
  return 'related_context';
}

function buildPreparationReason(
  prepTitle: string,
  anchor: AnchorTask,
  relationType: RelationType,
): string {
  const anchorTimeStr = anchor.startTime.substring(11, 16);
  const anchorTitle = anchor.title;
  switch (relationType) {
    case 'decision_before_event':
      return `זוהתה כהחלטה שצריך לקבל לפני ${anchorTitle}`;
    case 'reminder_before_event':
      return `זוהתה כתזכורת הקשורה ל${anchorTitle} ב-${anchorTimeStr}`;
    case 'prepare_for_event':
      return `זוהתה כמשימת הכנה ל${anchorTitle}`;
    case 'before_departure':
      return `זוהתה כמשימה לביצוע לפני ${anchorTitle} ב-${anchorTimeStr}`;
    default:
      return `זוהתה כמשימה הקשורה ל${anchorTitle}`;
  }
}

// ── buildAnchorContext ────────────────────────────────────────────────────────

/**
 * buildAnchorContext
 * מזהה anchor tasks ו-preparation tasks מתוך הרשימה,
 * ומחזיר קישורים ביניהם עם הקשר לשיבוץ.
 *
 * @param tasks  — raw task records (מה-DB או מה-body)
 * @param dateIso — תאריך השיבוץ
 */
export function buildAnchorContext(
  tasks: Record<string, any>[],
  dateIso: string,
): AnchorContext {
  const anchors: AnchorTask[] = [];
  const preparationLinks: PreparationLink[] = [];
  const warnings: string[] = [];

  // ── שלב 1: זיהוי anchors ──────────────────────────────────────────────────
  for (const task of tasks) {
    if (!isAnchorTask(task)) continue;
    const startIso = getStartTimeIso(task);
    if (!startIso) continue;

    // וודא שה-anchor הוא ביום הנוכחי
    if (!startIso.startsWith(dateIso)) continue;

    anchors.push({
      taskId: task.id ?? '',
      title: task.title ?? '',
      startTime: startIso,
      anchorType: detectAnchorType(task.title ?? ''),
      keywords: extractKeywords(task.title ?? '', ANCHOR_KEYWORDS),
    });
  }

  if (anchors.length === 0) {
    return { anchors, preparationLinks, warnings };
  }

  // ── שלב 2: זיהוי preparation tasks וקישורן לanchor ──────────────────────
  for (const task of tasks) {
    if (!isPrepTask(task)) continue;
    const taskId = task.id ?? '';
    const taskTitle = task.title ?? '';

    // בדוק האם ה-prep task כבר anchor — לא נרצה לחבר anchor לעצמו
    const isAlreadyAnchor = anchors.some(a => a.taskId === taskId);
    if (isAlreadyAnchor) continue;

    // מצא את ה-anchor הרלוונטי ביותר
    // קדימות: anchor שיש לו מילות מפתח משותפות עם ה-prep task
    const prepKeywords = extractKeywords(taskTitle, PREP_KEYWORDS);
    const sharedEntities = extractKeywords(taskTitle, SHARED_ENTITY_KEYWORDS);

    let bestAnchor: AnchorTask | null = null;
    let bestScore = 0;

    for (const anchor of anchors) {
      let score = 0;
      // מילות מפתח anchor בכותרת ה-prep
      for (const kw of anchor.keywords) {
        if (taskTitle.includes(kw)) score += 3;
      }
      // ישויות משותפות
      for (const entity of SHARED_ENTITY_KEYWORDS) {
        if (taskTitle.includes(entity) && anchor.title.includes(entity)) score += 2;
      }
      // גם ה-prep task יש מילות מפתח?
      if (prepKeywords.length > 0) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestAnchor = anchor;
      }
    }

    // אם אין קישור ברור, קשר לראשון
    if (!bestAnchor && anchors.length > 0) {
      // רק אם יש לפחות מילת מפתח prep
      if (prepKeywords.length > 0) {
        bestAnchor = anchors[0];
        bestScore = 1;
      }
    }

    if (!bestAnchor || bestScore === 0) continue;

    const relationType = detectRelationType(taskTitle);

    preparationLinks.push({
      taskId,
      anchorTaskId: bestAnchor.taskId,
      relationType,
      suggestedLatestEndIso: bestAnchor.startTime,
      reason: buildPreparationReason(taskTitle, bestAnchor, relationType),
    });
  }

  // ── שלב 3: warnings ───────────────────────────────────────────────────────
  if (anchors.length > 0 && preparationLinks.length === 0) {
    warnings.push(`זוהה אירוע עוגן (${anchors[0].title}) אך לא זוהו משימות הכנה קשורות`);
  }

  return { anchors, preparationLinks, warnings };
}

// ── buildSchedulingContextReasons ────────────────────────────────────────────

/**
 * buildSchedulingContextReasons
 * בונה רשימת סיבות שיבוץ ייחודיות לכל משימה מתוזמנת.
 *
 * @param taskId       — ID המשימה המתוזמנת
 * @param startTimeStr — שעת תחילה "HH:MM" מהתשובה
 * @param endTimeStr   — שעת סיום "HH:MM"
 * @param anchorCtx    — הקשר anchor שחושב
 * @param nowIso       — nowIso לצורך זיהוי שיבוץ "אחרי עכשיו"
 */
export function buildSchedulingContextReasons(
  taskId: string,
  taskTitle: string,
  startTimeStr: string,
  endTimeStr: string,
  anchorCtx: AnchorContext,
  nowIso: string,
): string[] {
  const reasons: string[] = [];

  // האם ה-task הוא anchor?
  const asAnchor = anchorCtx.anchors.find(a => a.taskId === taskId);
  if (asAnchor) {
    reasons.push(`זוהה כאירוע עוגן בסוג "${asAnchor.anchorType}"`);
    reasons.push(`שובץ לפי הזמן הקבוע שלו — ${asAnchor.startTime.substring(11, 16)}`);
    return reasons;
  }

  // האם ה-task הוא preparation?
  const asPrep = anchorCtx.preparationLinks.find(p => p.taskId === taskId);
  if (asPrep) {
    const anchor = anchorCtx.anchors.find(a => a.taskId === asPrep.anchorTaskId);
    const anchorTimeStr = anchor?.startTime.substring(11, 16) ?? '';
    const anchorTitle = anchor?.title ?? 'אירוע';
    reasons.push(asPrep.reason);
    if (anchorTimeStr) {
      reasons.push(`שובץ לפני אירוע העוגן ב-${anchorTimeStr}`);
    }
    if (taskTitle.includes('להעיר') || taskTitle.includes('לזכור')) {
      reasons.push('שובץ סמוך לאירוע ולא בתחילת היום');
    }
    if (taskTitle.includes('להחליט')) {
      reasons.push('ההחלטה צריכה להתקבל לפני שאר ההכנות');
    }
    return reasons;
  }

  // אחרת — סיבה גנרית (קצרה)
  reasons.push('שובץ בחלון זמן פנוי מתאים');

  return reasons;
}
