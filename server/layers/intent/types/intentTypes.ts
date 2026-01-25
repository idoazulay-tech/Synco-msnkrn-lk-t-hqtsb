// Intent-related type definitions

export type InputType = 'command' | 'thought' | 'question' | 'correction' | 'emotional_dump';

export type PrimaryIntent = 
  | 'create_task' 
  | 'create_event' 
  | 'reschedule' 
  | 'cancel' 
  | 'inquire' 
  | 'log_note'
  | 'complete_task'
  | 'decompose_task'
  | 'journal_entry'
  | 'set_constraint'
  | 'manage_day'
  | 'unknown';

export type CommitmentLevel = 'high' | 'medium' | 'low';
export type CognitiveLoad = 'low' | 'medium' | 'high';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type Language = 'he' | 'en' | 'mixed';

export interface IntentSignals {
  keywordsMatched: string[];
  patternsMatched: string[];
}

export interface InternalNotes {
  notes: string[];
  signals: IntentSignals;
}

export interface IntentAnalysis {
  inputType: InputType;
  primaryIntent: PrimaryIntent;
  secondaryIntents: PrimaryIntent[];
  commitmentLevel: CommitmentLevel;
  entities: ExtractedEntities;
  cognitiveLoad: CognitiveLoad;
  missingInfo: string[];
  confidenceScore: number;
  context: ContextInfo;
  internal: InternalNotes;
  rawText: string;
}

export interface ContextInfo {
  isFollowUp: boolean;
  refersToPrevious: boolean;
  previousTurnId: string;
  topic: string;
  assumptions: string[];
}

export type RelativeAnchorType = 
  | 'after_current_block_end' 
  | 'at_next_block_start' 
  | 'after_next_block_end';

export interface RelativeAnchor {
  type: RelativeAnchorType;
  confidence: number;
  raw: string;
}

export interface ExtractedEntities {
  time: EntityValue<string>;
  date: EntityValue<string>;
  duration: EntityValue<number>;
  people: EntityValue<string[]>;
  location: EntityValue<string>;
  taskName: EntityValue<string>;
  urgency: EntityValue<UrgencyLevel>;
  must: EntityValue<boolean>;
  constraints: ConstraintData[];
  relativeAnchor: RelativeAnchor | null;
}

export interface EntityValue<T> {
  raw: string;
  normalized: T;
  confidence: number;
}

export interface ConstraintData {
  type: ConstraintType;
  details: Record<string, unknown>;
}

export type ConstraintType = 
  | 'deadline' 
  | 'allowed_window' 
  | 'forbidden_window' 
  | 'energy_profile' 
  | 'reduced_load_day';
