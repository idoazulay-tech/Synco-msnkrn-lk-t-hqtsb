import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingTasks: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  isRelated: boolean;
  relationReason?: string;
}

export interface MAMessage {
  id: string;
  type: 'question' | 'info' | 'success' | 'warning' | 'conflict';
  text: string;
  timestamp: Date;
  taskTitle?: string;
  options?: string[];
  answered?: boolean;
  response?: string;
  conflict?: ConflictInfo;
  newTaskInfo?: {
    title: string;
    startTime: string;
    endTime: string;
  };
}

export interface PlanOption {
  id: string;
  label: string;
  description: string;
  tasks: { title: string; time: string }[];
}

export interface PlanChoice {
  id: string;
  question: string;
  timestamp: Date;
  planA: PlanOption;
  planB: PlanOption;
  chosen?: 'A' | 'B';
}

interface MAState {
  messages: MAMessage[];
  planChoices: PlanChoice[];
  
  addMessage: (message: Omit<MAMessage, 'id' | 'timestamp'>) => void;
  answerMessage: (id: string, response: string) => void;
  clearMessages: () => void;
  
  addPlanChoice: (choice: Omit<PlanChoice, 'id' | 'timestamp'>) => void;
  choosePlan: (id: string, choice: 'A' | 'B') => void;
  
  getUnansweredMessages: () => MAMessage[];
  getUnresolvedPlanChoices: () => PlanChoice[];
}

export const useMAStore = create<MAState>()(
  persist(
    (set, get) => ({
      messages: [],
      planChoices: [],
      
      addMessage: (message) => {
        const newMessage: MAMessage = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [newMessage, ...state.messages],
        }));
      },
      
      answerMessage: (id, response) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, answered: true, response } : m
          ),
        }));
      },
      
      clearMessages: () => {
        set({ messages: [], planChoices: [] });
      },
      
      addPlanChoice: (choice) => {
        const newChoice: PlanChoice = {
          ...choice,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set((state) => ({
          planChoices: [newChoice, ...state.planChoices],
        }));
      },
      
      choosePlan: (id, choice) => {
        set((state) => ({
          planChoices: state.planChoices.map((p) =>
            p.id === id ? { ...p, chosen: choice } : p
          ),
        }));
      },
      
      getUnansweredMessages: () => {
        return get().messages.filter((m) => !m.answered);
      },
      
      getUnresolvedPlanChoices: () => {
        return get().planChoices.filter((p) => !p.chosen);
      },
    }),
    {
      name: 'ma-storage',
      partialize: (state) => ({
        messages: state.messages,
        planChoices: state.planChoices,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.messages = state.messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        state.planChoices = state.planChoices.map((p) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        }));
      },
    }
  )
);
