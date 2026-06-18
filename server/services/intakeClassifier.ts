// Pure classification logic for the intake organizer.
// No Prisma dependency — fully testable without mocks.

export type IntakeType = 'single_task' | 'multi_task' | 'project';

export interface IntakeTask {
  title: string;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface IntakeProjectStep {
  title: string;
  orderIndex: number;
}

export interface IntakePreview {
  type: IntakeType;
  rawText: string;
  tasks: IntakeTask[];
  project?: {
    title: string;
    description?: string;
    goalText?: string;
    steps: IntakeProjectStep[];
  };
  openQuestions: string[];
}

// Hebrew keywords that signal a multi-step project rather than a task list.
const PROJECT_KEYWORDS_HE = [
  'פרויקט', 'מיזם', 'לבנות', 'לפתח', 'לתכנן תוכנית', 'להכין תוכנית',
  'תהליך', 'יוזמה', 'אסטרטגיה', 'מסגרת',
];

// Hebrew words that typically separate tasks in a list.
const LIST_SEPARATORS = /[\n\r,،;،]+|(?:^|\s)[-•*]\s/m;

export function classifyIntentText(text: string): IntakeType {
  const trimmed = text.trim();
  if (!trimmed) return 'single_task';

  const lower = trimmed.toLowerCase();

  // Project signals take priority
  if (PROJECT_KEYWORDS_HE.some(kw => lower.includes(kw))) {
    return 'project';
  }

  // Multi-task if text contains list separators or multiple lines
  const lines = trimmed.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) return 'multi_task';
  if (LIST_SEPARATORS.test(trimmed)) return 'multi_task';

  return 'single_task';
}

export function extractTasksFromText(text: string): IntakeTask[] {
  const lines = text
    .split(/[\n\r,،;،]+/)
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [{ title: text.trim() }];

  return lines.map(line => {
    const priority = detectPriority(line);
    return {
      title: stripPriorityWords(line),
      ...(priority !== 'medium' ? { priority } : {}),
    };
  });
}

export function decomposeProjectText(text: string): IntakePreview['project'] {
  const lines = text
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  // First non-empty line (or full text if single line) becomes the project title
  const titleLine = lines[0] ?? text.trim();
  const title = cleanProjectTitle(titleLine);
  const goalText = lines.length > 1 ? lines.slice(1).join(' ').slice(0, 200) : undefined;

  // Derive steps: remaining lines, or fallback generic steps
  const stepLines =
    lines.length > 1
      ? lines.slice(1).filter(l => l.length > 2)
      : deriveGenericSteps(title);

  const steps: IntakeProjectStep[] = stepLines.map((s, i) => ({
    title: s.replace(/^[-•*\d.]\s*/, '').trim(),
    orderIndex: i,
  }));

  // Ensure at least 2 steps
  while (steps.length < 2) {
    steps.push({ title: `שלב ${steps.length + 1}`, orderIndex: steps.length });
  }

  return { title, goalText, steps };
}

export function buildIntakePreview(rawText: string): IntakePreview {
  const type = classifyIntentText(rawText);
  const openQuestions: string[] = [];

  if (type === 'project') {
    const project = decomposeProjectText(rawText);
    return { type, rawText, tasks: [], project, openQuestions };
  }

  const tasks = extractTasksFromText(rawText);

  if (tasks.length === 0) {
    openQuestions.push('מה בדיוק צריך לעשות?');
  }

  return { type, rawText, tasks, openQuestions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPriority(text: string): 'high' | 'medium' | 'low' {
  const l = text.toLowerCase();
  if (/דחוף|חשוב מאד|עדיפות גבוהה/.test(l)) return 'high';
  if (/לא דחוף|נמוך|עדיפות נמוכה/.test(l)) return 'low';
  return 'medium';
}

function stripPriorityWords(text: string): string {
  return text
    .replace(/\s*(דחוף|חשוב מאד|עדיפות גבוהה|לא דחוף|עדיפות נמוכה)\s*/g, ' ')
    .trim();
}

function cleanProjectTitle(line: string): string {
  return line
    .replace(/^(פרויקט|מיזם|לבנות|לפתח|לתכנן|להכין)[\s:]+/i, '')
    .trim() || line.trim();
}

function deriveGenericSteps(projectTitle: string): string[] {
  return [
    `תכנון ${projectTitle}`,
    `ביצוע ${projectTitle}`,
    `בדיקה ואישור`,
  ];
}
