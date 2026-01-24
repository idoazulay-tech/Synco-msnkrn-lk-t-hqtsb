// Layer 4: Task & Time Engine - In-Memory Store

import type { Task, Event, Note, ScheduleBlock, TaskType } from '../types/taskTypes.js';
import type { Question, Reflection } from '../../decision/types/decisionTypes.js';
import type { SessionState } from '../../intent/types/contextTypes.js';
import type { StoreState, DecisionLogEntry, PendingPlanProposal } from './storeTypes.js';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class InMemoryStore {
  private state: StoreState;

  constructor() {
    this.state = {
      tasks: [],
      events: [],
      notes: [],
      scheduleBlocks: [],
      lastQuestion: null,
      lastReflection: null,
      contextState: null,
      decisionLog: [],
      pendingPlanProposal: null
    };
  }

  getState(): StoreState {
    return { ...this.state };
  }

  // Task CRUD
  addTask(task: Omit<Task, 'id' | 'createdAtIso' | 'updatedAtIso' | 'taskType'> & { taskType?: TaskType }): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      taskType: task.taskType || 'general',
      id: generateId(),
      createdAtIso: now,
      updatedAtIso: now
    };
    this.state.tasks.push(newTask);
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const index = this.state.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    this.state.tasks[index] = {
      ...this.state.tasks[index],
      ...updates,
      updatedAtIso: new Date().toISOString()
    };
    return this.state.tasks[index];
  }

  getTask(id: string): Task | null {
    return this.state.tasks.find(t => t.id === id) || null;
  }

  deleteTask(id: string): boolean {
    const index = this.state.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.state.tasks.splice(index, 1);
    this.removeBlockByRef(id);
    return true;
  }

  // Event CRUD
  addEvent(event: Omit<Event, 'id' | 'createdAtIso' | 'updatedAtIso'>): Event {
    const now = new Date().toISOString();
    const newEvent: Event = {
      ...event,
      id: generateId(),
      createdAtIso: now,
      updatedAtIso: now
    };
    this.state.events.push(newEvent);
    return newEvent;
  }

  updateEvent(id: string, updates: Partial<Event>): Event | null {
    const index = this.state.events.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    this.state.events[index] = {
      ...this.state.events[index],
      ...updates,
      updatedAtIso: new Date().toISOString()
    };
    return this.state.events[index];
  }

  getEvent(id: string): Event | null {
    return this.state.events.find(e => e.id === id) || null;
  }

  deleteEvent(id: string): boolean {
    const index = this.state.events.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.state.events.splice(index, 1);
    this.removeBlockByRef(id);
    return true;
  }

  // Note CRUD
  addNote(note: Omit<Note, 'id' | 'createdAtIso'>): Note {
    const newNote: Note = {
      ...note,
      id: generateId(),
      createdAtIso: new Date().toISOString()
    };
    this.state.notes.push(newNote);
    return newNote;
  }

  // Schedule Blocks
  addBlock(block: Omit<ScheduleBlock, 'id'>): ScheduleBlock {
    const newBlock: ScheduleBlock = {
      ...block,
      id: generateId()
    };
    this.state.scheduleBlocks.push(newBlock);
    this.sortBlocks();
    return newBlock;
  }

  updateBlock(id: string, updates: Partial<ScheduleBlock>): ScheduleBlock | null {
    const index = this.state.scheduleBlocks.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    this.state.scheduleBlocks[index] = {
      ...this.state.scheduleBlocks[index],
      ...updates
    };
    this.sortBlocks();
    return this.state.scheduleBlocks[index];
  }

  removeBlockByRef(refId: string): boolean {
    const index = this.state.scheduleBlocks.findIndex(b => b.refId === refId);
    if (index === -1) return false;
    this.state.scheduleBlocks.splice(index, 1);
    return true;
  }

  getBlocksForDate(dateIso: string): ScheduleBlock[] {
    return this.state.scheduleBlocks.filter(b => 
      b.startTimeIso.startsWith(dateIso)
    );
  }

  clearBlocksForDate(dateIso: string): void {
    this.state.scheduleBlocks = this.state.scheduleBlocks.filter(b => 
      !b.startTimeIso.startsWith(dateIso)
    );
  }

  setBlocks(blocks: ScheduleBlock[]): void {
    this.state.scheduleBlocks = blocks;
    this.sortBlocks();
  }

  private sortBlocks(): void {
    this.state.scheduleBlocks.sort((a, b) => 
      a.startTimeIso.localeCompare(b.startTimeIso)
    );
  }

  // Question and Reflection
  setLastQuestion(question: Question | null): void {
    this.state.lastQuestion = question;
  }

  setLastReflection(reflection: Reflection | null): void {
    this.state.lastReflection = reflection;
  }

  // Context State
  setContextState(contextState: SessionState | null): void {
    this.state.contextState = contextState;
  }

  // Decision Log
  addDecisionLog(entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>): void {
    this.state.decisionLog.push({
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString()
    });
  }

  // PATCH 2: Pending Plan Proposal
  setPendingPlanProposal(proposal: PendingPlanProposal | null): void {
    this.state.pendingPlanProposal = proposal;
  }

  getPendingPlanProposal(): PendingPlanProposal | null {
    return this.state.pendingPlanProposal;
  }

  clearPendingPlanProposal(): void {
    this.state.pendingPlanProposal = null;
  }

  isPlanProposalExpired(): boolean {
    if (!this.state.pendingPlanProposal) return true;
    return new Date(this.state.pendingPlanProposal.expiresAtIso) < new Date();
  }

  // Reset
  reset(): void {
    this.state = {
      tasks: [],
      events: [],
      notes: [],
      scheduleBlocks: [],
      lastQuestion: null,
      lastReflection: null,
      contextState: null,
      decisionLog: [],
      pendingPlanProposal: null
    };
  }
}

// Singleton instance
let storeInstance: InMemoryStore | null = null;

export function getStore(): InMemoryStore {
  if (!storeInstance) {
    storeInstance = new InMemoryStore();
  }
  return storeInstance;
}

export function resetStore(): void {
  if (storeInstance) {
    storeInstance.reset();
  }
}
