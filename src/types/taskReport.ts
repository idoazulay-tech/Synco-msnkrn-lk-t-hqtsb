export interface TaskReportOption {
  id: string;
  label: string;
  category: string;
}

export const TASK_REPORT_OPTIONS: TaskReportOption[] = [
  { id: 'low_energy',          label: 'אין לי אנרגיה',                    category: 'energy'     },
  { id: 'unclear_first_step',  label: 'לא ברור לי הצעד הראשון',           category: 'clarity'    },
  { id: 'too_big',             label: 'המשימה גדולה מדי',                  category: 'size'       },
  { id: 'dependency_missing',  label: 'אני צריך משהו לפני',               category: 'dependency' },
  { id: 'wrong_timing',        label: 'השעה לא מתאימה',                   category: 'timing'     },
  { id: 'waiting_on_someone',  label: 'אני מחכה למישהו',                  category: 'waiting'    },
  { id: 'not_sure_priority',   label: 'אני לא בטוח שזה חשוב עכשיו',      category: 'priority'   },
  { id: 'resistance',          label: 'יש לי התנגדות להתחיל',             category: 'resistance' },
  { id: 'want_to_avoid',       label: 'אני רוצה להתחמק מזה עכשיו',        category: 'avoidance'  },
  { id: 'want_to_finish',      label: 'אני כן רוצה לסיים, רק צריך עזרה', category: 'ready'      },
  { id: 'ready',               label: 'אני מוכן להתחיל',                  category: 'ready'      },
  { id: 'other',               label: 'אחר',                              category: 'other'      },
];

export type UserIntention =
  | 'wants_to_do'
  | 'wants_help'
  | 'wants_to_delay'
  | 'wants_to_cancel'
  | 'unsure_priority'
  | 'avoiding_now';

export type NormalizedCategory =
  | 'energy'
  | 'clarity'
  | 'size'
  | 'dependency'
  | 'timing'
  | 'waiting'
  | 'priority'
  | 'resistance'
  | 'avoidance'
  | 'ready'
  | 'other';

export interface OperationalBlueprint {
  taskType: string;
  goal: string;
  expectedOutcome: string;
  resourcesNeeded: string[];
  firstStep: string;
  steps: string[];
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
  clarifyingQuestions?: string[];
}

export interface SuggestedBreakdown {
  firstStep: string;
  steps: string[];
  resourcesNeeded: string[];
  assumptions: string[];
}

export interface TaskReportAnalysis {
  scope: 'task_only';
  normalizedCategory: NormalizedCategory;
  userIntention: UserIntention;
  confidence: 'low' | 'medium' | 'high';
  immediateSuggestion: string;
  suggestedActions: string[];
  followUpQuestions?: string[];
  taskMeaning?: string;
  consequenceIfNotDone?: string;
  suggestedBreakdown?: SuggestedBreakdown;
  operationalBlueprint?: OperationalBlueprint;
  learningMetadata?: Record<string, unknown>;
}
