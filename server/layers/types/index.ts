// Core types for 7-layer AI system

// Input Types
export type InputType = 'command' | 'thought' | 'question' | 'correction' | 'emotional_dump';

// Primary Intents
export type PrimaryIntent = 
  | 'create_task'
  | 'create_event'
  | 'reschedule'
  | 'inquire'
  | 'cancel'
  | 'complete_task'
  | 'decompose_task'
  | 'journal_entry'
  | 'set_constraint'
  | 'manage_day'
  | 'unknown';

// Commitment Levels
export type CommitmentLevel = 'high' | 'medium' | 'low';

// Cognitive Load
export type CognitiveLoad = 'low' | 'medium' | 'high';

// Constraint Types
export type ConstraintType = 
  | 'deadline'
  | 'must_be_at_place_by'
  | 'allowed_window'
  | 'forbidden_window'
  | 'precedence'
  | 'energy_profile'
  | 'travel_buffer'
  | 'trigger_after_meal'
  | 'home_work_block'
  | 'reduced_load_day';

// Relative anchor types for scheduling relative to timeline
export type RelativeAnchorType = 
  | 'after_current_block_end' 
  | 'at_next_block_start' 
  | 'after_next_block_end';

export interface RelativeAnchor {
  type: RelativeAnchorType;
  confidence: number;
  raw: string;
}

// Entities extracted from input
export interface ExtractedEntities {
  time?: string;
  date?: string;
  duration?: number;
  people?: string[];
  location?: string;
  task_name?: string;
  deadline?: string;
  constraints?: ConstraintData[];
  relativeAnchor?: RelativeAnchor | null;
}

// Constraint data structure
export interface ConstraintData {
  type: ConstraintType;
  details: Record<string, any>;
}

// Intent Engine Output
export interface IntentAnalysis {
  inputType: InputType;
  primaryIntent: PrimaryIntent;
  commitmentLevel: CommitmentLevel;
  entities: ExtractedEntities;
  cognitiveLoad: CognitiveLoad;
  missingInfo: string[];
  confidenceScore: number;
  rawText: string;
}

// Decision Engine Types
export type DecisionAction = 'execute' | 'ask' | 'reflect' | 'stop';

export interface DecisionResult {
  action: DecisionAction;
  reason: string;
  followUpQuestions?: string[];
  executionPlan?: ExecutionStep[];
}

// Task Engine Types
export interface ExecutionStep {
  id: string;
  title: string;
  estimatedMinutes: number;
  confidence: 'high' | 'medium' | 'low';
  dependencies?: string[];
}

export interface TaskDecomposition {
  subtasksEnabled: boolean;
  subtasks: ExecutionStep[];
  totalEstimateMinutes: number | null;
  notes: string | null;
}

// Personal Time Stats
export interface PersonalTimeStat {
  pattern: string;
  avgMinutes: number;
  samples: number;
  notes: string | null;
}

// Day Plan Block
export interface PlanBlock {
  start: string;
  end: string;
  title: string;
  kind: 'task' | 'event' | 'break';
  taskId?: string;
}

// Day Management Output
export interface DayManagementResult {
  questions: DayQuestion[];
  updatedPlanBlocks: PlanBlock[];
  changeLog: string[];
}

export interface DayQuestion {
  id: string;
  question: string;
  options: string[];
}

// Learning Engine Types
export interface LearningEntry {
  timestamp: Date;
  inputType: InputType;
  intent: PrimaryIntent;
  decision: DecisionAction;
  outcome: 'success' | 'failure' | 'partial';
  notes?: string;
}

// Layer Interface
export interface Layer<TInput, TOutput> {
  process(input: TInput): Promise<TOutput>;
}
