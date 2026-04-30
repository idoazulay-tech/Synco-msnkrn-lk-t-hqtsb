import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, StandbyTask, HistoryEntry, Tag, DEFAULT_TAGS, TaskTemplate, TemplateCategory } from '@/types/task';
import { addHours, addMinutes, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { expandRecurring, getMasterTaskId } from '@/lib/recurringEngine';

interface TaskState {
  tasks: Task[];
  standbyTasks: StandbyTask[];
  archivedTasks: Task[];
  tags: Tag[];
  templates: TaskTemplate[];
  templateCategories: TemplateCategory[];
  
  // Task Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string, completed: boolean) => void;
  moveToStandby: (id: string, notes: string) => void;
  scheduleStandbyTask: (id: string, startTime: Date, endTime: Date) => void;
  
  // Template Actions
  addTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => TaskTemplate;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  deleteTemplate: (id: string) => void;
  scheduleTemplate: (id: string, startTime: Date) => Task;
  getTemplatesSorted: () => TaskTemplate[];
  
  // Category Actions
  addCategory: (category: Omit<TemplateCategory, 'id' | 'createdAt' | 'order'>) => TemplateCategory;
  updateCategory: (id: string, updates: Partial<TemplateCategory>) => void;
  deleteCategory: (id: string) => void;
  
  // Getters
  getCurrentTask: () => Task | null;
  getTasksForDay: (date: Date) => Task[];
  getTaskById: (id: string) => Task | undefined;
  
  // History
  addHistoryEntry: (taskId: string, entry: Omit<HistoryEntry, 'id' | 'taskId' | 'timestamp'>) => void;
  
  // Archive
  clearArchive: () => void;
}


export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      standbyTasks: [],
      archivedTasks: [],
      tags: DEFAULT_TAGS,
      templates: [],
      templateCategories: [],

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          history: [{
            id: crypto.randomUUID(),
            taskId: '',
            eventType: 'created',
            timestamp: new Date(),
          }],
        };
        newTask.history[0].taskId = newTask.id;
        
        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));
        
        return newTask;
      },

      updateTask: (id, updates) => {
        const resolvedId = id.includes('_occ_') ? getMasterTaskId(id) : id;
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === resolvedId
              ? {
                  ...task,
                  ...updates,
                  updatedAt: new Date(),
                  history: [
                    ...task.history,
                    {
                      id: crypto.randomUUID(),
                      taskId: resolvedId,
                      eventType: 'modified',
                      timestamp: new Date(),
                      details: JSON.stringify(updates),
                    },
                  ],
                }
              : task
          ),
        }));
      },

      deleteTask: (id) => {
        const resolvedId = id.includes('_occ_') ? getMasterTaskId(id) : id;
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== resolvedId),
        }));
      },

      completeTask: (id, completed) => {
        const resolvedId = id.includes('_occ_') ? getMasterTaskId(id) : id;
        const task = get().tasks.find((t) => t.id === resolvedId);
        if (!task) return;

        const updatedTask: Task = {
          ...task,
          status: completed ? 'completed' : 'not_completed',
          completedAt: completed ? new Date() : undefined,
          updatedAt: new Date(),
          history: [
            ...task.history,
            {
              id: crypto.randomUUID(),
              taskId: resolvedId,
              eventType: completed ? 'completed' : 'not_completed',
              timestamp: new Date(),
            },
          ],
        };

        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== resolvedId),
          archivedTasks: [...state.archivedTasks, updatedTask],
        }));
      },

      moveToStandby: (id, notes) => {
        const resolvedId = id.includes('_occ_') ? getMasterTaskId(id) : id;
        const task = get().tasks.find((t) => t.id === resolvedId);
        if (!task) return;

        const standbyTask: StandbyTask = {
          ...task,
          notes,
          status: 'standby',
        };

        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== resolvedId),
          standbyTasks: [...state.standbyTasks, standbyTask],
        }));
      },

      scheduleStandbyTask: (id, startTime, endTime) => {
        const resolvedId = getMasterTaskId(id);
        const standbyTask = get().standbyTasks.find((t) => t.id === resolvedId);
        if (!standbyTask) return;

        const scheduledTask: Task = {
          ...standbyTask,
          startTime,
          endTime,
          status: 'pending',
          updatedAt: new Date(),
          history: [
            ...standbyTask.history,
            {
              id: crypto.randomUUID(),
              taskId: resolvedId,
              eventType: 'moved',
              timestamp: new Date(),
              details: `Scheduled from standby to ${startTime.toISOString()}`,
            },
          ],
        };

        set((state) => ({
          standbyTasks: state.standbyTasks.filter((t) => t.id !== resolvedId),
          tasks: [...state.tasks, scheduledTask],
        }));
      },

      getCurrentTask: () => {
        const now = new Date();
        const todayTasks = get().getTasksForDay(now);
        
        const activeTasks = todayTasks.filter((task) => {
          if (task.status === 'completed' || task.status === 'not_completed') {
            return false;
          }
          const startTime = new Date(task.startTime);
          const endTime = new Date(task.endTime);
          return isWithinInterval(now, { start: startTime, end: endTime });
        });
        
        if (activeTasks.length === 0) return null;
        
        return activeTasks.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )[0];
      },

      getTasksForDay: (date: Date) => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        const regularTasks = get().tasks.filter((task) => {
          const startTime = new Date(task.startTime);
          const endTime = new Date(task.endTime);
          return isWithinInterval(startTime, { start: dayStart, end: dayEnd }) ||
            (isWithinInterval(endTime, { start: dayStart, end: dayEnd }) && !isWithinInterval(startTime, { start: dayStart, end: dayEnd }));
        });

        const recurringOccurrences: Task[] = [];
        get().tasks.forEach((task) => {
          if (task.repeat) {
            const occurrences = expandRecurring(task, dayStart, dayEnd);
            recurringOccurrences.push(...occurrences.filter((occ) => {
              const occStart = new Date(occ.startTime);
              return isWithinInterval(occStart, { start: dayStart, end: dayEnd });
            }));
          }
        });

        return [...regularTasks, ...recurringOccurrences]
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      },

      getTaskById: (id: string) => {
        const direct = get().tasks.find((task) => task.id === id);
        if (direct) return direct;
        
        if (id.includes('_occ_')) {
          const masterId = getMasterTaskId(id);
          const master = get().tasks.find((task) => task.id === masterId);
          if (master) {
            const dateStr = id.substring(id.lastIndexOf('_occ_') + 5);
            const [y, m, d] = dateStr.split('-').map(Number);
            const occDate = new Date(y, m - 1, d);
            if (!isNaN(occDate.getTime())) {
              const occurrences = expandRecurring(master, startOfDay(occDate), endOfDay(occDate));
              return occurrences.find((occ) => occ.id === id);
            }
          }
        }
        return undefined;
      },

      addHistoryEntry: (taskId, entry) => {
        const resolvedTaskId = taskId.includes('_occ_') ? getMasterTaskId(taskId) : taskId;
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === resolvedTaskId
              ? {
                  ...task,
                  history: [
                    ...task.history,
                    {
                      ...entry,
                      id: crypto.randomUUID(),
                      taskId,
                      timestamp: new Date(),
                    },
                  ],
                }
              : task
          ),
        }));
      },

      clearArchive: () => {
        set({ archivedTasks: [] });
      },

      // Template Actions
      addTemplate: (templateData) => {
        const newTemplate: TaskTemplate = {
          ...templateData,
          id: crypto.randomUUID(),
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          templates: [...state.templates, newTemplate],
        }));
        
        return newTemplate;
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, ...updates, updatedAt: new Date() }
              : template
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      scheduleTemplate: (id, startTime) => {
        const template = get().templates.find((t) => t.id === id);
        if (!template) throw new Error('Template not found');

        const endTime = addMinutes(startTime, template.duration);
        
        // Update template usage stats
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? { ...t, usageCount: t.usageCount + 1, lastUsedAt: new Date(), updatedAt: new Date() }
              : t
          ),
        }));

        // Create the scheduled task
        const newTask: Task = {
          id: crypto.randomUUID(),
          title: template.title,
          description: template.description,
          location: template.location,
          startTime,
          endTime,
          duration: template.duration,
          status: 'pending',
          tags: template.tags,
          createdAt: new Date(),
          updatedAt: new Date(),
          history: [{
            id: crypto.randomUUID(),
            taskId: '',
            eventType: 'created',
            timestamp: new Date(),
            details: `Created from template: ${template.title}`,
          }],
        };
        newTask.history[0].taskId = newTask.id;
        
        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));
        
        return newTask;
      },

      getTemplatesSorted: () => {
        const templates = get().templates;
        
        // Sort by: recently used first, then by frequency, then by creation date
        return [...templates].sort((a, b) => {
          // First: recently used (last 24 hours get priority)
          const now = Date.now();
          const dayAgo = now - 24 * 60 * 60 * 1000;
          const aRecentlyUsed = a.lastUsedAt && a.lastUsedAt.getTime() > dayAgo;
          const bRecentlyUsed = b.lastUsedAt && b.lastUsedAt.getTime() > dayAgo;
          
          if (aRecentlyUsed && !bRecentlyUsed) return -1;
          if (!aRecentlyUsed && bRecentlyUsed) return 1;
          
          // If both recently used, sort by most recent
          if (aRecentlyUsed && bRecentlyUsed) {
            return (b.lastUsedAt?.getTime() || 0) - (a.lastUsedAt?.getTime() || 0);
          }
          
          // Then: by usage frequency
          if (a.usageCount !== b.usageCount) {
            return b.usageCount - a.usageCount;
          }
          
          // Finally: by creation date (newest first)
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      },

      // Category Actions
      addCategory: (categoryData) => {
        const categories = get().templateCategories;
        const newCategory: TemplateCategory = {
          ...categoryData,
          id: crypto.randomUUID(),
          order: categories.length,
          createdAt: new Date(),
        };
        
        set((state) => ({
          templateCategories: [...state.templateCategories, newCategory],
        }));
        
        return newCategory;
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          templateCategories: state.templateCategories.map((cat) =>
            cat.id === id ? { ...cat, ...updates } : cat
          ),
        }));
      },

      deleteCategory: (id) => {
        set((state) => ({
          templateCategories: state.templateCategories.filter((c) => c.id !== id),
          // Also remove category from templates
          templates: state.templates.map((t) =>
            t.categoryId === id ? { ...t, categoryId: undefined } : t
          ),
        }));
      },
    }),
    {
      name: 'task-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        standbyTasks: state.standbyTasks,
        archivedTasks: state.archivedTasks,
        tags: state.tags,
        templates: state.templates,
        templateCategories: state.templateCategories,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
        // Rehydrate Date fields for tasks
        state.tasks = state.tasks.map(task => ({
          ...task,
          startTime: new Date(task.startTime),
          endTime: new Date(task.endTime),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          history: task.history.map(h => ({
            ...h,
            timestamp: new Date(h.timestamp),
          })),
        }));
        
        // Rehydrate Date fields for standbyTasks
        state.standbyTasks = state.standbyTasks.map(task => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          history: task.history.map(h => ({
            ...h,
            timestamp: new Date(h.timestamp),
          })),
        }));
        
        // Rehydrate Date fields for archivedTasks
        state.archivedTasks = state.archivedTasks.map(task => ({
          ...task,
          startTime: new Date(task.startTime),
          endTime: new Date(task.endTime),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          history: task.history.map(h => ({
            ...h,
            timestamp: new Date(h.timestamp),
          })),
        }));
        
        // Rehydrate Date fields for templates
        state.templates = (state.templates || []).map(template => ({
          ...template,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
          lastUsedAt: template.lastUsedAt ? new Date(template.lastUsedAt) : undefined,
        }));
        
        // Rehydrate Date fields for templateCategories
        state.templateCategories = (state.templateCategories || []).map(cat => ({
          ...cat,
          createdAt: new Date(cat.createdAt),
        }));
      },
    }
  )
);
