import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, StandbyTask, HistoryEntry, Tag, DEFAULT_TAGS } from '@/types/task';
import { addHours, addMinutes, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface TaskState {
  tasks: Task[];
  standbyTasks: StandbyTask[];
  archivedTasks: Task[];
  tags: Tag[];
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string, completed: boolean) => void;
  moveToStandby: (id: string, notes: string) => void;
  scheduleStandbyTask: (id: string, startTime: Date, endTime: Date) => void;
  
  // Getters
  getCurrentTask: () => Task | null;
  getTasksForDay: (date: Date) => Task[];
  getTaskById: (id: string) => Task | undefined;
  
  // History
  addHistoryEntry: (taskId: string, entry: Omit<HistoryEntry, 'id' | 'taskId' | 'timestamp'>) => void;
}


export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      standbyTasks: [],
      archivedTasks: [],
      tags: DEFAULT_TAGS,

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
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  ...updates,
                  updatedAt: new Date(),
                  history: [
                    ...task.history,
                    {
                      id: crypto.randomUUID(),
                      taskId: id,
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
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
      },

      completeTask: (id, completed) => {
        const task = get().tasks.find((t) => t.id === id);
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
              taskId: id,
              eventType: completed ? 'completed' : 'not_completed',
              timestamp: new Date(),
            },
          ],
        };

        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          archivedTasks: [...state.archivedTasks, updatedTask],
        }));
      },

      moveToStandby: (id, notes) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;

        const standbyTask: StandbyTask = {
          ...task,
          notes,
          status: 'standby',
        };

        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          standbyTasks: [...state.standbyTasks, standbyTask],
        }));
      },

      scheduleStandbyTask: (id, startTime, endTime) => {
        const standbyTask = get().standbyTasks.find((t) => t.id === id);
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
              taskId: id,
              eventType: 'moved',
              timestamp: new Date(),
              details: `Scheduled from standby to ${startTime.toISOString()}`,
            },
          ],
        };

        set((state) => ({
          standbyTasks: state.standbyTasks.filter((t) => t.id !== id),
          tasks: [...state.tasks, scheduledTask],
        }));
      },

      getCurrentTask: () => {
        const now = new Date();
        const tasks = get().tasks;
        
        // Find all tasks that are currently active (now is within their time range)
        const activeTasks = tasks.filter((task) =>
          task.status !== 'completed' &&
          task.status !== 'not_completed' &&
          isWithinInterval(now, { start: task.startTime, end: task.endTime })
        );
        
        // Return the first one by start time (earliest started task gets priority)
        if (activeTasks.length === 0) return null;
        
        return activeTasks.sort((a, b) => 
          a.startTime.getTime() - b.startTime.getTime()
        )[0];
      },

      getTasksForDay: (date: Date) => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        return get().tasks.filter((task) =>
          isWithinInterval(task.startTime, { start: dayStart, end: dayEnd })
        ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      },

      getTaskById: (id: string) => {
        return get().tasks.find((task) => task.id === id);
      },

      addHistoryEntry: (taskId, entry) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
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
    }),
    {
      name: 'task-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        standbyTasks: state.standbyTasks,
        archivedTasks: state.archivedTasks,
        tags: state.tags,
      }),
    }
  )
);
