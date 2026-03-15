export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'not_completed' | 'standby';

export type SchedulingStatus = 'pending' | 'scheduled';

export type TimeConstraintType = 'HARD_LOCK' | 'HUMAN_DEPENDENT' | 'FLEX_WINDOW' | 'FILL_GAPS';

export type HistoryEventType = 
  | 'created' 
  | 'started' 
  | 'completed' 
  | 'not_completed' 
  | 'postponed' 
  | 'modified' 
  | 'moved';

export interface CreatedFrom {
  source: 'user_input' | 'org_response' | 'template' | 'manual';
  tsIso: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface HistoryEntry {
  id: string;
  taskId: string;
  eventType: HistoryEventType;
  timestamp: Date;
  details?: string;
  previousValue?: string;
  newValue?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskFlexibility = 'fixed' | 'flexible' | 'anytime';

export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatEndType = 'never' | 'date' | 'count';

export interface RecurringRule {
  frequency: RepeatFrequency;
  interval: number;
  daysOfWeek?: number[];
  endType: RepeatEndType;
  endDate?: string;
  endCount?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  status: TaskStatus;
  schedulingStatus?: SchedulingStatus;
  timeConstraintType?: TimeConstraintType;
  createdFrom?: CreatedFrom;
  priority?: TaskPriority;
  flexibility?: TaskFlexibility;
  canMove?: boolean;
  repeat?: RecurringRule | null;
  isAllDay?: boolean;
  tags: Tag[];
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  history: HistoryEntry[];
}

export interface StandbyTask extends Omit<Task, 'startTime' | 'endTime'> {
  notes: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface DaySchedule {
  date: Date;
  tasks: Task[];
}

// Template Category for organizing task templates (general categories)
export interface TemplateCategory {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string; // for subcategories
  createdAt: Date;
}

// Default general categories with subcategories
export const DEFAULT_CATEGORIES: { name: string; color: string; subcategories: string[] }[] = [
  { name: 'בית', color: '#10B981', subcategories: ['אוכל', 'ניקיון', 'כביסה', 'סידור'] },
  { name: 'בריאות', color: '#EF4444', subcategories: ['רופא', 'תרופות', 'בדיקות', 'טיפול'] },
  { name: 'ספורט', color: '#F59E0B', subcategories: ['אימון', 'ריצה', 'חדר כושר', 'שחייה'] },
  { name: 'בירוקרטיה', color: '#6366F1', subcategories: ['מסמכים', 'טפסים', 'תשלומים', 'פגישות'] },
  { name: 'זוגיות', color: '#EC4899', subcategories: ['דייט', 'יום נישואין', 'מתנה', 'שיחה'] },
  { name: 'משפחה', color: '#8B5CF6', subcategories: ['ילדים', 'הורים', 'אירוע', 'ביקור'] },
  { name: 'כסף', color: '#22C55E', subcategories: ['בנק', 'חשבונות', 'השקעות', 'תקציב'] },
  { name: 'חברים', color: '#14B8A6', subcategories: ['מפגש', 'יום הולדת', 'טלפון', 'אירוע'] },
  { name: 'עבודה', color: '#3B82F6', subcategories: ['פגישה', 'משימה', 'דוח', 'שיחה'] },
  { name: 'לימודים', color: '#A855F7', subcategories: ['שיעור', 'מבחן', 'עבודה', 'קריאה'] },
  { name: 'תחזוקה', color: '#78716C', subcategories: ['רכב', 'בית', 'מכשירים', 'גינה'] },
  { name: 'קניות', color: '#F97316', subcategories: ['מזון', 'ביגוד', 'מתנות', 'ציוד'] },
  { name: 'סידורים', color: '#06B6D4', subcategories: ['דואר', 'משלוחים', 'איסוף', 'החזרה'] },
  { name: 'נסיעות', color: '#0EA5E9', subcategories: ['טיסה', 'מלון', 'טיול', 'תכנון'] },
  { name: 'פנאי', color: '#84CC16', subcategories: ['סרט', 'מסעדה', 'תחביב', 'קריאה'] },
];

// Task Template - stored in "המתנה" for quick scheduling
export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  location?: string;
  duration: number; // in minutes
  categoryId?: string;
  tags: Tag[];
  usageCount: number; // for sorting by frequency
  lastUsedAt?: Date; // for sorting by recent usage
  createdAt: Date;
  updatedAt: Date;
}

// Default tags
export const DEFAULT_TAGS: Tag[] = [
  { id: '1', name: 'בית', color: 'hsl(142 71% 45%)', icon: '🏠' },
  { id: '2', name: 'עבודה', color: 'hsl(217 91% 60%)', icon: '💼' },
  { id: '3', name: 'חשבונות', color: 'hsl(38 92% 50%)', icon: '📄' },
  { id: '4', name: 'כסף', color: 'hsl(142 71% 45%)', icon: '💰' },
  { id: '5', name: 'ספורט', color: 'hsl(0 84% 60%)', icon: '🏃' },
  { id: '6', name: 'בריאות', color: 'hsl(280 70% 55%)', icon: '❤️' },
];
