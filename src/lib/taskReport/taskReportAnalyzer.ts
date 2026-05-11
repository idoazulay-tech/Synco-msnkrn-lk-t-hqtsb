import { Task } from '@/types/task';
import {
  TaskReportAnalysis,
  UserIntention,
  NormalizedCategory,
  OperationalBlueprint,
} from '@/types/taskReport';
import {
  buildTaskOperationalBlueprint,
  buildSuggestedBreakdown,
} from '@/lib/taskOperational/taskOperationalBlueprintEngine';

interface AnalyzeTaskReportInput {
  task: Task;
  selectedOption: string;
  freeText?: string;
  now: Date;
  settings?: Record<string, unknown>;
  dayContext?: Record<string, unknown>;
}

const HEBREW_PERSON_HINTS = ['שני', 'הבוס', 'לקוח', 'שלמה', 'ירון', 'מנהל', 'חבר', 'חברה', 'אח', 'אחות'];

function hasMentionOfPerson(text: string): boolean {
  const lower = text.toLowerCase();
  return HEBREW_PERSON_HINTS.some((hint) => lower.includes(hint));
}

function buildTaskMeaning(task: Task): string {
  if (task.tags && task.tags.length > 0) {
    return `המשימה קשורה ל${task.tags.map((t) => t.name).join(', ')}.`;
  }
  return 'עדיין לא ידוע לאיזו מטרה המשימה קשורה.';
}

function buildConsequence(task: Task, selectedOption: string): string {
  if (selectedOption === 'waiting_on_someone') {
    return 'נראה שיש כאן תלות באדם אחר, ולכן כדאי להגדיר מה הצעד הבא שלך.';
  }
  if (task.startTime) {
    return 'אם היא לא תתבצע בזמן, ייתכן שהיא תידחק לזמן פחות מתאים.';
  }
  return 'עדיין לא ידועה השלכה ברורה. אפשר להוסיף מטרה או סיבה למשימה.';
}

interface OptionMapping {
  userIntention: UserIntention;
  normalizedCategory: NormalizedCategory;
  immediateSuggestion: string;
  suggestedActions: string[];
  confidence: 'low' | 'medium' | 'high';
  needsBlueprint?: boolean;
}

const OPTION_MAP: Record<string, OptionMapping> = {
  low_energy: {
    userIntention: 'wants_help',
    normalizedCategory: 'energy',
    immediateSuggestion: 'נעשה התחלה קטנה בלבד: 2 דקות.',
    suggestedActions: ['start_2_minutes', 'delay_30', 'switch_to_lighter'],
    confidence: 'medium',
  },
  unclear_first_step: {
    userIntention: 'wants_help',
    normalizedCategory: 'clarity',
    immediateSuggestion: 'נפרק את המשימה לצעד ראשון ברור.',
    suggestedActions: ['break_down_task', 'ask_task_questions', 'start_task'],
    confidence: 'medium',
    needsBlueprint: true,
  },
  too_big: {
    userIntention: 'wants_help',
    normalizedCategory: 'size',
    immediateSuggestion: 'נקטין את המשימה לחלק ראשון קטן.',
    suggestedActions: ['split_task', 'start_2_minutes'],
    confidence: 'medium',
    needsBlueprint: true,
  },
  dependency_missing: {
    userIntention: 'wants_help',
    normalizedCategory: 'dependency',
    immediateSuggestion: 'נזהה קודם מה חסר כדי להתחיל.',
    suggestedActions: ['create_prerequisite', 'add_note'],
    confidence: 'medium',
    needsBlueprint: true,
  },
  wrong_timing: {
    userIntention: 'wants_to_delay',
    normalizedCategory: 'timing',
    immediateSuggestion: 'אפשר לדחות לזמן מתאים יותר ולשמור את הסיבה.',
    suggestedActions: ['delay_15', 'delay_30', 'delay_60'],
    confidence: 'high',
  },
  waiting_on_someone: {
    userIntention: 'wants_help',
    normalizedCategory: 'waiting',
    immediateSuggestion: 'נסמן שיש כאן תלות במישהו אחר.',
    suggestedActions: ['mark_waiting', 'create_followup'],
    confidence: 'high',
  },
  not_sure_priority: {
    userIntention: 'unsure_priority',
    normalizedCategory: 'priority',
    immediateSuggestion: 'נבדוק מה המשימה מקדמת ומה המחיר אם לא עושים אותה.',
    suggestedActions: ['ask_goal', 'compare_day_plan'],
    confidence: 'low',
  },
  resistance: {
    userIntention: 'wants_help',
    normalizedCategory: 'resistance',
    immediateSuggestion: 'אפשר להתחיל בלי להתחייב לסיים, רק 2 דקות.',
    suggestedActions: ['start_2_minutes', 'break_down_task'],
    confidence: 'medium',
  },
  want_to_avoid: {
    userIntention: 'avoiding_now',
    normalizedCategory: 'avoidance',
    immediateSuggestion: 'קיבלתי. נבדוק אם נכון לדחות, לפרק, או לבטל.',
    suggestedActions: ['ask_consequence', 'delay_30', 'break_down_task'],
    confidence: 'medium',
  },
  want_to_finish: {
    userIntention: 'wants_to_do',
    normalizedCategory: 'ready',
    immediateSuggestion: 'מעולה. נמצא את הדרך הכי פשוטה להתחיל.',
    suggestedActions: ['ask_first_step', 'start_task'],
    confidence: 'high',
  },
  ready: {
    userIntention: 'wants_to_do',
    normalizedCategory: 'ready',
    immediateSuggestion: 'מעולה. אפשר להתחיל עכשיו.',
    suggestedActions: ['start_task'],
    confidence: 'high',
  },
  other: {
    userIntention: 'wants_help',
    normalizedCategory: 'other',
    immediateSuggestion: 'קיבלתי. אשמור את זה בהקשר של המשימה הזאת.',
    suggestedActions: ['save_note'],
    confidence: 'low',
  },
};

export function analyzeTaskReport(input: AnalyzeTaskReportInput): TaskReportAnalysis {
  const { task, selectedOption, freeText, now } = input;

  const mapping: OptionMapping = OPTION_MAP[selectedOption] ?? OPTION_MAP['other'];

  let { immediateSuggestion, suggestedActions } = mapping;
  let operationalBlueprint: OperationalBlueprint | undefined;
  let followUpQuestions: string[] | undefined;

  const personMentioned = freeText && hasMentionOfPerson(freeText);

  if (mapping.needsBlueprint) {
    const blueprint = buildTaskOperationalBlueprint({
      task,
      selectedOption,
      freeText,
    });
    operationalBlueprint = blueprint;
    const breakdown = buildSuggestedBreakdown(blueprint);

    if (blueprint.taskType !== 'generic_task') {
      immediateSuggestion = `נראה שהצעד הראשון הוא: ${breakdown.firstStep}.`;
    } else {
      followUpQuestions = blueprint.clarifyingQuestions;
    }

    if (mapping.normalizedCategory === 'dependency') {
      suggestedActions = ['identify_dependency', 'add_note', 'create_prerequisite'];
    }
  }

  if (mapping.confidence === 'low' && !followUpQuestions) {
    followUpQuestions = ['מה התוצאה שאתה רוצה שתהיה בסוף המשימה?'];
  }

  const taskMeaning = buildTaskMeaning(task);
  const consequenceIfNotDone = buildConsequence(task, selectedOption);

  const learningMetadata: Record<string, unknown> = {
    scope: 'task_only',
    selectedOption,
    taskId: task.id,
    taskTitle: task.title,
    nowIso: now.toISOString(),
    hasPersonContext: personMentioned ?? false,
    taskStatus: task.status,
    taskPriority: task.priority ?? null,
  };

  if (personMentioned) {
    learningMetadata.personContextNote = 'במשימה הזאת יש הקשר לאדם אחר.';
  }

  const suggestedBreakdown = operationalBlueprint
    ? buildSuggestedBreakdown(operationalBlueprint)
    : undefined;

  return {
    scope: 'task_only',
    normalizedCategory: mapping.normalizedCategory,
    userIntention: mapping.userIntention,
    confidence: mapping.confidence,
    immediateSuggestion,
    suggestedActions,
    followUpQuestions,
    taskMeaning,
    consequenceIfNotDone,
    suggestedBreakdown,
    operationalBlueprint,
    learningMetadata,
  };
}
