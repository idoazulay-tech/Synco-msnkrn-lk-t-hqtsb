import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomReportOption {
  id: string;
  label: string;
  createdAt: string;
  usageCount: number;
}

interface TaskReportOptionsState {
  customOptions: CustomReportOption[];
  addCustomOption: (label: string) => void;
  incrementUsage: (id: string) => void;
  removeCustomOption: (id: string) => void;
}

export const useTaskReportOptionsStore = create<TaskReportOptionsState>()(
  persist(
    (set, get) => ({
      customOptions: [],

      addCustomOption: (rawLabel: string) => {
        const label = rawLabel.trim().slice(0, 40);
        if (!label) return;
        const existing = get().customOptions.find(
          (o) => o.label.toLowerCase() === label.toLowerCase()
        );
        if (existing) {
          set((state) => ({
            customOptions: state.customOptions.map((o) =>
              o.id === existing.id ? { ...o, usageCount: o.usageCount + 1 } : o
            ),
          }));
          return;
        }
        const newOption: CustomReportOption = {
          id: `custom_${Date.now()}`,
          label,
          createdAt: new Date().toISOString(),
          usageCount: 1,
        };
        set((state) => ({ customOptions: [...state.customOptions, newOption] }));
      },

      incrementUsage: (id: string) => {
        set((state) => ({
          customOptions: state.customOptions.map((o) =>
            o.id === id ? { ...o, usageCount: o.usageCount + 1 } : o
          ),
        }));
      },

      removeCustomOption: (id: string) => {
        set((state) => ({
          customOptions: state.customOptions.filter((o) => o.id !== id),
        }));
      },
    }),
    { name: 'synco_task_report_custom_options' }
  )
);
