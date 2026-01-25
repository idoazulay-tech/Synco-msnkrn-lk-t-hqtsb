// Layer 4: Task & Time Engine
// Manages tasks, decomposition, time estimation, constraints

import type { 
  IntentAnalysis, 
  TaskDecomposition, 
  ExecutionStep,
  PersonalTimeStat,
  PlanBlock,
  DayManagementResult,
  DayQuestion,
  RelativeAnchorType
} from '../types';

// Timeline block for anchor resolution
export interface TimelineBlock {
  id: string;
  startIso: string;
  endIso: string;
  title: string;
}

// Anchor resolution result
export interface AnchorResolutionResult {
  startIso: string | null;
  anchorType: RelativeAnchorType;
  resolvedFrom: 'current_block' | 'next_block' | 'fallback_now' | 'no_timeline';
  blockTitle?: string;
}

/**
 * Resolve the start time for a task based on a relative anchor
 * 
 * @param anchorType - The type of relative anchor
 * @param timeline - Array of timeline blocks sorted by startIso
 * @param nowIso - Current time in ISO format
 * @returns The resolved start time or null if cannot resolve
 */
export function resolveAnchorStartIso(
  anchorType: RelativeAnchorType,
  timeline: TimelineBlock[],
  nowIso: string
): AnchorResolutionResult {
  const now = new Date(nowIso);
  
  if (!timeline || timeline.length === 0) {
    return {
      startIso: nowIso,
      anchorType,
      resolvedFrom: 'no_timeline'
    };
  }
  
  // Find current block (now is between startIso and endIso)
  const currentBlock = timeline.find(block => {
    const start = new Date(block.startIso);
    const end = new Date(block.endIso);
    return now >= start && now < end;
  });
  
  // Find next block (first block where startIso is after now)
  const nextBlock = timeline.find(block => {
    const start = new Date(block.startIso);
    return start > now;
  });
  
  switch (anchorType) {
    case 'after_current_block_end':
      if (currentBlock) {
        return {
          startIso: currentBlock.endIso,
          anchorType,
          resolvedFrom: 'current_block',
          blockTitle: currentBlock.title
        };
      }
      // Fallback: no current block, use now
      return {
        startIso: nowIso,
        anchorType,
        resolvedFrom: 'fallback_now'
      };
      
    case 'at_next_block_start':
      if (nextBlock) {
        return {
          startIso: nextBlock.startIso,
          anchorType,
          resolvedFrom: 'next_block',
          blockTitle: nextBlock.title
        };
      }
      // Fallback: no next block, use now
      return {
        startIso: nowIso,
        anchorType,
        resolvedFrom: 'fallback_now'
      };
      
    case 'after_next_block_end':
      if (nextBlock) {
        return {
          startIso: nextBlock.endIso,
          anchorType,
          resolvedFrom: 'next_block',
          blockTitle: nextBlock.title
        };
      }
      // Fallback: no next block, use now
      return {
        startIso: nowIso,
        anchorType,
        resolvedFrom: 'fallback_now'
      };
      
    default:
      return {
        startIso: nowIso,
        anchorType,
        resolvedFrom: 'fallback_now'
      };
  }
}

// Default time estimates by task type
const DEFAULT_ESTIMATES: Record<string, number> = {
  'להתקשר': 10,
  'לשלוח': 5,
  'לקנות': 30,
  'לסדר': 20,
  'לנקות': 30,
  'לבשל': 45,
  'פגישה': 60,
  'תור': 30,
  'default': 15
};

// Quantity modifiers
const QUANTITY_MODIFIERS: Record<string, number> = {
  'קצת': 0.5,
  'מעט': 0.5,
  'הרבה': 2.0,
  'מלא': 2.0,
  'רגיל': 1.0
};

function getBaseEstimate(taskName: string): number {
  for (const [key, minutes] of Object.entries(DEFAULT_ESTIMATES)) {
    if (taskName.includes(key)) {
      return minutes;
    }
  }
  return DEFAULT_ESTIMATES.default;
}

function applyQuantityModifier(text: string, baseMinutes: number): number {
  for (const [modifier, multiplier] of Object.entries(QUANTITY_MODIFIERS)) {
    if (text.includes(modifier)) {
      return Math.round(baseMinutes * multiplier);
    }
  }
  return baseMinutes;
}

function applyPersonalStats(
  taskPattern: string, 
  estimate: number, 
  stats: PersonalTimeStat[]
): number {
  const matchingStat = stats.find(s => taskPattern.includes(s.pattern));
  if (matchingStat && matchingStat.samples >= 3) {
    // Weighted average: 70% personal, 30% default
    return Math.round(matchingStat.avgMinutes * 0.7 + estimate * 0.3);
  }
  return estimate;
}

export function estimateTaskDuration(
  taskName: string, 
  rawText: string,
  personalStats: PersonalTimeStat[] = []
): number {
  let estimate = getBaseEstimate(taskName);
  estimate = applyQuantityModifier(rawText, estimate);
  estimate = applyPersonalStats(taskName, estimate, personalStats);
  return estimate;
}

export function decomposeTask(
  analysis: IntentAnalysis,
  autoDecomposeEnabled: boolean = false,
  personalStats: PersonalTimeStat[] = []
): TaskDecomposition {
  const { entities, rawText, primaryIntent } = analysis;
  const taskName = entities.task_name || '';

  // Check if decomposition should happen
  const explicitRequest = /פרק|תפרק|שלבים|צעדים/.test(rawText);
  if (!explicitRequest && !autoDecomposeEnabled) {
    const totalEstimate = estimateTaskDuration(taskName, rawText, personalStats);
    return {
      subtasksEnabled: false,
      subtasks: [],
      totalEstimateMinutes: totalEstimate,
      notes: null
    };
  }

  // Generic decomposition pattern: prep -> do -> cleanup
  const subtasks: ExecutionStep[] = [];
  const baseEstimate = estimateTaskDuration(taskName, rawText, personalStats);

  // Food-related decomposition
  if (/אוכל|לאכול|לבשל|להכין|סנדוויץ|ארוחה/.test(rawText)) {
    subtasks.push(
      { id: '1', title: 'להוציא מצרכים', estimatedMinutes: 2, confidence: 'high' },
      { id: '2', title: 'להכין/לחמם', estimatedMinutes: Math.round(baseEstimate * 0.5), confidence: 'medium' },
      { id: '3', title: 'לאכול', estimatedMinutes: 15, confidence: 'medium' },
      { id: '4', title: 'לסדר ולשטוף', estimatedMinutes: 5, confidence: 'high' }
    );
  }
  // Cleaning decomposition
  else if (/לנקות|לסדר|כלים|לשטוף/.test(rawText)) {
    subtasks.push(
      { id: '1', title: 'להתחיל', estimatedMinutes: 2, confidence: 'high' },
      { id: '2', title: 'לבצע', estimatedMinutes: Math.round(baseEstimate * 0.8), confidence: 'medium' },
      { id: '3', title: 'לסיים ולסדר', estimatedMinutes: 3, confidence: 'high' }
    );
  }
  // Generic decomposition
  else {
    subtasks.push(
      { id: '1', title: 'הכנה', estimatedMinutes: Math.round(baseEstimate * 0.2), confidence: 'medium' },
      { id: '2', title: 'ביצוע', estimatedMinutes: Math.round(baseEstimate * 0.6), confidence: 'medium' },
      { id: '3', title: 'סיום', estimatedMinutes: Math.round(baseEstimate * 0.2), confidence: 'medium' }
    );
  }

  const totalEstimate = subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return {
    subtasksEnabled: true,
    subtasks,
    totalEstimateMinutes: totalEstimate,
    notes: autoDecomposeEnabled && !explicitRequest ? 'פירוק אוטומטי' : null
  };
}

// Day management - placeholder for LLM integration
export function manageDayPlan(
  targetDate: string,
  existingBlocks: PlanBlock[],
  constraints: any[],
  userPreference: { keepOriginalOrder: boolean; allowReorder: boolean }
): DayManagementResult {
  // This will be enhanced with LLM integration
  const questions: DayQuestion[] = [];
  
  // Check for gaps in schedule
  if (existingBlocks.length > 0) {
    const hasLargeGap = existingBlocks.some((block, i) => {
      if (i === 0) return false;
      const prevEnd = existingBlocks[i - 1].end;
      const currStart = block.start;
      // Simple gap check (would need proper time parsing)
      return parseInt(currStart.split(':')[0]) - parseInt(prevEnd.split(':')[0]) > 2;
    });
    
    if (hasLargeGap) {
      questions.push({
        id: 'gap_usage',
        question: 'יש לך רווח גדול בלוז. מה תרצה לעשות איתו?',
        options: ['להוסיף משימות', 'להשאיר כזמן פנוי', 'לדחוס משימות קיימות', 'לא יודע']
      });
    }
  }

  return {
    questions,
    updatedPlanBlocks: existingBlocks,
    changeLog: []
  };
}

export class TaskEngine {
  async decompose(
    analysis: IntentAnalysis,
    autoDecomposeEnabled: boolean = false,
    personalStats: PersonalTimeStat[] = []
  ): Promise<TaskDecomposition> {
    return decomposeTask(analysis, autoDecomposeEnabled, personalStats);
  }

  async manageDay(
    targetDate: string,
    existingBlocks: PlanBlock[],
    constraints: any[],
    userPreference: { keepOriginalOrder: boolean; allowReorder: boolean }
  ): Promise<DayManagementResult> {
    return manageDayPlan(targetDate, existingBlocks, constraints, userPreference);
  }
}

// READY FOR NEXT LAYER: Learning Engine
