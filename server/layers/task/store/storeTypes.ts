// Layer 4: Task & Time Engine - Store Types

import type { Task, Event, Note, ScheduleBlock } from '../types/taskTypes.js';
import type { Question, Reflection } from '../../decision/types/decisionTypes.js';
import type { SessionState } from '../../intent/types/contextTypes.js';
import type { ReshufflePlan } from '../types/scheduleTypes.js';

// PATCH 2: Pending Plan Proposal for Reshuffle Plan A/B
export interface PlanChange {
  entityType: 'task' | 'event';
  entityId: string;
  change: 'shorten' | 'move' | 'cancel';
  details: {
    newDuration?: number;
    newStartTime?: string;
    reason?: string;
  };
}

export interface PlanOption {
  planId: 'A' | 'B';
  titleHebrew: string;
  summaryHebrew: string;
  changes: PlanChange[];
}

export interface PendingPlanProposal {
  id: string;
  createdAtIso: string;
  reason: 'reshuffle';
  plans: PlanOption[];
  expiresAtIso: string;
}

export interface StoreState {
  tasks: Task[];
  events: Event[];
  notes: Note[];
  scheduleBlocks: ScheduleBlock[];
  lastQuestion: Question | null;
  lastReflection: Reflection | null;
  contextState: SessionState | null;
  decisionLog: DecisionLogEntry[];
  pendingPlanProposal: PendingPlanProposal | null;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  decision: string;
  selectedPlan: ReshufflePlan | null;
  reason: string;
}

export interface UIInstructions {
  showQuestionModal: boolean;
  showReflectionCard: boolean;
  showPlanChoiceModal: boolean;
  refreshTimeline: boolean;
  refreshTaskList: boolean;
  planOptions: ReshufflePlan[] | null;
  pendingPlanProposal: PendingPlanProposal | null;
  message: string | null;
  messageType: 'success' | 'warning' | 'error' | 'info' | null;
}

export interface ProcessResult {
  success: boolean;
  state: StoreState;
  uiInstructions: UIInstructions;
}
