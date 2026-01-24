import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InquiryReason = 'missing_info' | 'conflict' | 'related_tasks' | 'time_clarification';
export type ExpectedAnswerType = 'choice' | 'confirm' | 'duration' | 'free_text' | 'plan_choice' | 'time' | 'date';

export interface OrgQuestion {
  id: string;
  textHebrew: string;
  options?: string[];
  expectedAnswerType: ExpectedAnswerType;
  relatedEntityId?: string;
}

export interface OrgInquiry {
  id: string;
  createdAtIso: string;
  status: 'pending' | 'resolved';
  reason: InquiryReason;
  entity: {
    type: 'task' | 'event';
    id: string;
    title: string;
  };
  message: {
    titleHebrew: string;
    bodyHebrew: string;
  };
  question: OrgQuestion;
  meta: {
    missingInfo: string[];
    conflictId?: string;
    relatedIds?: string[];
  };
}

interface OrgState {
  pendingInquiries: OrgInquiry[];
  lastQuestionContext: {
    inquiryId: string;
    questionId: string;
    expectedAnswerType: ExpectedAnswerType;
    options?: string[];
  } | null;
  lastShownInquiryId: string | null;

  addInquiry: (inquiry: Omit<OrgInquiry, 'id' | 'createdAtIso' | 'status'>) => OrgInquiry;
  updateInquiry: (id: string, updates: Partial<OrgInquiry>) => void;
  resolveInquiry: (id: string) => void;
  updateInquiryQuestion: (id: string, newQuestion: OrgQuestion) => void;
  setLastQuestionContext: (context: OrgState['lastQuestionContext']) => void;
  setLastShownInquiryId: (id: string | null) => void;
  
  getPendingInquiries: () => OrgInquiry[];
  getFirstPendingInquiry: () => OrgInquiry | null;
  getInquiryById: (id: string) => OrgInquiry | undefined;
  clearResolvedInquiries: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      pendingInquiries: [],
      lastQuestionContext: null,
      lastShownInquiryId: null,

      addInquiry: (inquiryData) => {
        const newInquiry: OrgInquiry = {
          ...inquiryData,
          id: crypto.randomUUID(),
          createdAtIso: new Date().toISOString(),
          status: 'pending',
        };
        
        set((state) => ({
          pendingInquiries: [...state.pendingInquiries, newInquiry],
          lastQuestionContext: {
            inquiryId: newInquiry.id,
            questionId: newInquiry.question.id,
            expectedAnswerType: newInquiry.question.expectedAnswerType,
            options: newInquiry.question.options,
          },
        }));
        
        return newInquiry;
      },

      updateInquiry: (id, updates) => {
        set((state) => ({
          pendingInquiries: state.pendingInquiries.map((inquiry) =>
            inquiry.id === id ? { ...inquiry, ...updates } : inquiry
          ),
        }));
      },

      resolveInquiry: (id) => {
        set((state) => ({
          pendingInquiries: state.pendingInquiries.map((inquiry) =>
            inquiry.id === id ? { ...inquiry, status: 'resolved' as const } : inquiry
          ),
        }));
      },

      updateInquiryQuestion: (id, newQuestion) => {
        set((state) => ({
          pendingInquiries: state.pendingInquiries.map((inquiry) =>
            inquiry.id === id ? { ...inquiry, question: newQuestion } : inquiry
          ),
          lastQuestionContext: {
            inquiryId: id,
            questionId: newQuestion.id,
            expectedAnswerType: newQuestion.expectedAnswerType,
            options: newQuestion.options,
          },
        }));
      },

      setLastQuestionContext: (context) => {
        set({ lastQuestionContext: context });
      },

      setLastShownInquiryId: (id) => {
        set({ lastShownInquiryId: id });
      },

      getPendingInquiries: () => {
        return get().pendingInquiries.filter((i) => i.status === 'pending');
      },

      getFirstPendingInquiry: () => {
        const pending = get().pendingInquiries.filter((i) => i.status === 'pending');
        return pending.length > 0 ? pending[0] : null;
      },

      getInquiryById: (id) => {
        return get().pendingInquiries.find((i) => i.id === id);
      },

      clearResolvedInquiries: () => {
        set((state) => ({
          pendingInquiries: state.pendingInquiries.filter((i) => i.status === 'pending'),
        }));
      },
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({
        pendingInquiries: state.pendingInquiries,
        lastQuestionContext: state.lastQuestionContext,
        lastShownInquiryId: state.lastShownInquiryId,
      }),
    }
  )
);
