import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Plus, GripVertical, Repeat } from 'lucide-react';
import { format, addDays, subDays, startOfDay, addHours, addMinutes, isSameHour, isSameDay, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';
import { isRecurringOccurrence } from '@/lib/recurringEngine';
import { PlanMyDayButton } from '@/components/planner/PlanMyDayButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 80;
const MIN_TASK_HEIGHT = 20;

type TaskDisplayMode = 'short' | 'long';

function getDisplayMode(rawHeightPx: number): TaskDisplayMode {
  const durationMin = Math.round(rawHeightPx / HOUR_HEIGHT * 60);
  return durationMin < 38 ? 'short' : 'long';
}

function getBlockFontSize(actualHeightPx: number): string {
  if (actualHeightPx <= 20) return 'text-[8px]';
  if (actualHeightPx <= 26) return 'text-[9px]';
  if (actualHeightPx <= 34) return 'text-[10px]';
  return 'text-xs';
}

function getBlockPadding(actualHeightPx: number): string {
  if (actualHeightPx <= 20) return 'px-1 py-0';
  if (actualHeightPx <= 30) return 'px-1.5 py-0.5';
  return 'px-2 py-1';
}

interface DragState {
  taskId: string;
  type: 'move' | 'resize-top' | 'resize-bottom';
  startY: number;
  originalTop: number;
  originalHeight: number;
  originalStartTime: Date;
  originalEndTime: Date;
}

interface TaskPosition {
  task: Task;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

const TaskItem = ({ 
  task, 
  isActive, 
  position,
  onDragStart,
  onResizeStart,
  onClick,
  isDragging,
}: { 
  task: Task; 
  isActive: boolean; 
  position: TaskPosition;
  onDragStart: (e: React.MouseEvent | React.TouchEvent, taskId: string) => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, taskId: string, type: 'top' | 'bottom') => void;
  onClick: () => void;
  isDragging: boolean;
}) => {
  const { percentage, remainingTime, isUrgent, isWarning } = useTaskTimer(isActive ? task : null);
  const isOverlapping = position.totalColumns > 1 && position.column > 0;
  const isOccurrence = isRecurringOccurrence(task.id);

  const getProgressColor = () => {
    if (isUrgent) return 'bg-timer-urgent';
    if (isWarning) return 'bg-timer-warning';
    return 'bg-timer-progress';
  };

  const columnWidth = 100 / position.totalColumns;
  const leftPercent = position.column * columnWidth;
  const actualHeight = Math.max(position.height, MIN_TASK_HEIGHT);
  const displayMode = getDisplayMode(position.height);
  const fontSize    = getBlockFontSize(actualHeight);
  const padding     = getBlockPadding(actualHeight);

  const startStr = format(task.startTime, 'HH:mm');
  const endStr   = format(task.endTime,   'HH:mm');

  const titleColor = (isActive || !isOverlapping)
    ? 'text-primary-foreground'
    : 'text-slate-900 dark:text-white';
  const timeColor = (isActive || !isOverlapping)
    ? 'text-primary-foreground/70'
    : 'text-slate-700 dark:text-white/70';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.8 : 1, scale: 1 }}
      className={cn(
        'absolute rounded-xl overflow-hidden select-none',
        'transition-shadow duration-200',
        isDragging ? 'shadow-2xl z-50 cursor-grabbing' : 'cursor-pointer hover:ring-2 hover:ring-primary/20',
        'border border-gray-800 dark:border-gray-300',
        isActive
          ? 'bg-primary text-primary-foreground shadow-lg'
          : isOverlapping
            ? 'bg-sky-300 dark:bg-sky-500 text-slate-900 dark:text-white'
            : 'bg-primary text-primary-foreground'
      )}
      style={{
        top: `${position.top}px`,
        height: `${actualHeight}px`,
        left: `calc(${leftPercent}% + 4px)`,
        width: `calc(${columnWidth}% - 8px)`,
        zIndex: isDragging ? 100 : (isActive ? 20 : 10),
      }}
      title={`${task.title} · ${startStr}–${endStr}`}
    >
      {/* ── Resize top handle ── */}
      {!isOccurrence && (
        <div
          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/10 z-10"
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, task.id, 'top'); }}
          onTouchStart={(e) => { e.stopPropagation(); onResizeStart(e, task.id, 'top'); }}
        >
          <div className="w-8 h-1 bg-white/50 rounded-full" />
        </div>
      )}

      {/* ── Content ── */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-center overflow-hidden leading-none',
          padding,
          isOccurrence ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        )}
        onClick={onClick}
        onMouseDown={(e) => !isOccurrence && onDragStart(e, task.id)}
        onTouchStart={(e) => !isOccurrence && onDragStart(e, task.id)}
        dir="rtl"
      >
        {/* short (1–37 min): everything on one line */}
        {displayMode === 'short' && (
          <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden">
            <span className={cn(fontSize, 'font-semibold truncate flex-1 min-w-0 leading-none', titleColor)}>
              {isOccurrence && <Repeat className="w-2 h-2 inline-block ml-0.5" />}
              {task.title}
            </span>
            <span dir="ltr" className={cn(fontSize, 'flex-shrink-0 whitespace-nowrap tabular-nums leading-none font-medium', timeColor)}>
              {startStr}–{endStr}
            </span>
          </div>
        )}

        {/* long (38+ min): title line, then time below */}
        {displayMode === 'long' && (
          <>
            <div className="flex items-start justify-between gap-1 min-w-0">
              <p className={cn(fontSize, 'font-semibold truncate flex-1 min-w-0', titleColor)}>
                {isOccurrence && <Repeat className="w-3 h-3 inline-block ml-1" />}
                {task.title}
              </p>
              {isActive && actualHeight > 60 && (
                <p className={cn('text-base font-bold tabular-nums flex-shrink-0', isUrgent ? 'text-destructive' : 'text-primary-foreground')}>
                  {Math.round(percentage)}%
                </p>
              )}
            </div>
            <p dir="ltr" className={cn('text-[10px] mt-0.5 tabular-nums', timeColor)}>
              {startStr} – {endStr}
            </p>
          </>
        )}
      </div>

      {/* ── Progress bar (long mode, active) ── */}
      {isActive && displayMode === 'long' && actualHeight > 30 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/20">
          <motion.div
            className={cn('h-full', getProgressColor())}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* ── Resize bottom handle ── */}
      {!isOccurrence && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/10 z-10"
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, task.id, 'bottom'); }}
          onTouchStart={(e) => { e.stopPropagation(); onResizeStart(e, task.id, 'bottom'); }}
        >
          <div className="w-8 h-1 bg-white/50 rounded-full" />
        </div>
      )}
    </motion.div>
  );
};

const tasksOverlap = (task1: Task, task2: Task): boolean => {
  return task1.startTime < task2.endTime && task2.startTime < task1.endTime;
};

const DayViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const getInitialDate = () => {
    if (location.state?.date) {
      return new Date(location.state.date);
    }
    return new Date();
  };
  
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [viewDays, setViewDays] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ top: 0, height: 0 });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTime, setCreateTime] = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  
  const { getTasksForDay, getCurrentTask, updateTask, addTask } = useTaskStore();
  const currentTask = getCurrentTask();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getDatesInView = useCallback(() => {
    const dates: Date[] = [];
    for (let i = 0; i < viewDays; i++) {
      dates.push(addDays(selectedDate, i));
    }
    return dates;
  }, [selectedDate, viewDays]);

  const calculateTaskPositions = useCallback((tasks: Task[], dayStart: Date): TaskPosition[] => {
    const sortedTasks = [...tasks].sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime() || 
      b.endTime.getTime() - a.endTime.getTime()
    );

    const columns: Task[][] = [];
    
    for (const task of sortedTasks) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const canPlace = columns[col].every(existingTask => !tasksOverlap(task, existingTask));
        if (canPlace) {
          columns[col].push(task);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([task]);
      }
    }

    const taskColumns = new Map<string, { column: number; totalColumns: number }>();
    
    for (const task of sortedTasks) {
      const overlappingTasks = sortedTasks.filter(t => tasksOverlap(task, t));
      const maxCols = Math.max(...overlappingTasks.map(t => {
        for (let col = 0; col < columns.length; col++) {
          if (columns[col].includes(t)) return col + 1;
        }
        return 1;
      }));
      
      let taskCol = 0;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].includes(task)) {
          taskCol = col;
          break;
        }
      }
      
      taskColumns.set(task.id, { column: taskCol, totalColumns: maxCols });
    }

    return sortedTasks.map(task => {
      const startMinutes = differenceInMinutes(task.startTime, dayStart);
      const endMinutes = differenceInMinutes(task.endTime, dayStart);
      const durationMinutes = endMinutes - startMinutes;
      
      const colInfo = taskColumns.get(task.id) || { column: 0, totalColumns: 1 };
      
      return {
        task,
        top: (startMinutes / 60) * HOUR_HEIGHT,
        height: (durationMinutes / 60) * HOUR_HEIGHT,
        column: colInfo.column,
        totalColumns: colInfo.totalColumns,
      };
    });
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, taskId: string, type: 'move' | 'resize-top' | 'resize-bottom' = 'move') => {
    e.preventDefault();
    const tasks = getDatesInView().flatMap(date => getTasksForDay(date));
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dayStart = startOfDay(task.startTime);
    const startMinutes = differenceInMinutes(task.startTime, dayStart);
    const endMinutes = differenceInMinutes(task.endTime, dayStart);

    setDragState({
      taskId,
      type,
      startY: clientY,
      originalTop: (startMinutes / 60) * HOUR_HEIGHT,
      originalHeight: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
      originalStartTime: task.startTime,
      originalEndTime: task.endTime,
    });
    setDragOffset({ top: 0, height: 0 });
  }, [getDatesInView, getTasksForDay]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, taskId: string, edge: 'top' | 'bottom') => {
    handleDragStart(e, taskId, edge === 'top' ? 'resize-top' : 'resize-bottom');
  }, [handleDragStart]);

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragState.startY;
      
      const snapToMinutes = 15;
      const pixelsPerMinute = HOUR_HEIGHT / 60;
      const deltaMinutes = Math.round(deltaY / pixelsPerMinute / snapToMinutes) * snapToMinutes;
      const snappedDeltaY = deltaMinutes * pixelsPerMinute;

      if (dragState.type === 'move') {
        setDragOffset({ top: snappedDeltaY, height: 0 });
      } else if (dragState.type === 'resize-top') {
        const minTop = -dragState.originalTop;
        const maxTop = dragState.originalHeight - MIN_TASK_HEIGHT;
        const clampedTop = Math.max(minTop, Math.min(snappedDeltaY, maxTop));
        setDragOffset({ top: clampedTop, height: -clampedTop });
      } else if (dragState.type === 'resize-bottom') {
        const newHeight = Math.max(MIN_TASK_HEIGHT - dragState.originalHeight, snappedDeltaY);
        setDragOffset({ top: 0, height: newHeight });
      }
    };

    const handleEnd = () => {
      if (!dragState) return;

      const task = getDatesInView().flatMap(date => getTasksForDay(date)).find(t => t.id === dragState.taskId);
      if (!task) {
        setDragState(null);
        return;
      }

      const pixelsPerMinute = HOUR_HEIGHT / 60;
      
      if (dragState.type === 'move') {
        const deltaMinutes = Math.round(dragOffset.top / pixelsPerMinute);
        const newStartTime = addMinutes(dragState.originalStartTime, deltaMinutes);
        const newEndTime = addMinutes(dragState.originalEndTime, deltaMinutes);
        updateTask(task.id, { startTime: newStartTime, endTime: newEndTime });
      } else if (dragState.type === 'resize-top') {
        const deltaMinutes = Math.round(dragOffset.top / pixelsPerMinute);
        const newStartTime = addMinutes(dragState.originalStartTime, deltaMinutes);
        if (newStartTime < dragState.originalEndTime) {
          updateTask(task.id, { startTime: newStartTime });
        }
      } else if (dragState.type === 'resize-bottom') {
        const deltaMinutes = Math.round(dragOffset.height / pixelsPerMinute);
        const newEndTime = addMinutes(dragState.originalEndTime, deltaMinutes);
        if (newEndTime > dragState.originalStartTime) {
          updateTask(task.id, { endTime: newEndTime });
        }
      }

      setDragState(null);
      setDragOffset({ top: 0, height: 0 });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [dragState, dragOffset, getDatesInView, getTasksForDay, updateTask]);

  const handleTimeSlotClick = useCallback((date: Date, hour: number, e: React.MouseEvent) => {
    if (dragState) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const minuteInHour = Math.floor((clickY / HOUR_HEIGHT) * 60 / 15) * 15;
    
    setCreateTime({ date, hour, minute: minuteInHour });
    setNewTaskTitle('');
    setNewTaskDuration(60);
    setShowCreateDialog(true);
  }, [dragState]);

  const handleCreateTask = useCallback(() => {
    if (!createTime || !newTaskTitle.trim()) return;

    const startTime = setMinutes(setHours(createTime.date, createTime.hour), createTime.minute);
    const endTime = addMinutes(startTime, newTaskDuration);

    addTask({
      title: newTaskTitle.trim(),
      startTime,
      endTime,
      duration: newTaskDuration,
      status: 'pending',
      tags: [],
    });

    setShowCreateDialog(false);
    setCreateTime(null);
  }, [createTime, newTaskTitle, newTaskDuration, addTask]);

  useEffect(() => {
    if (timelineRef.current && isSameDay(selectedDate, new Date())) {
      const currentHour = new Date().getHours();
      const scrollPosition = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
      
      setTimeout(() => {
        timelineRef.current?.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [selectedDate]);

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, viewDays));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, viewDays));

  const datesInView = getDatesInView();

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-center gap-2 pt-2 pb-1">
            {[1, 3].map(days => (
              <Button
                key={days}
                size="sm"
                variant={viewDays === days ? 'default' : 'outline'}
                onClick={() => setViewDays(days)}
                data-testid={`button-view-${days}-days`}
              >
                {days === 1 ? 'יום' : `${days} ימים`}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between px-3 pb-2">
            <button 
              onClick={goToPreviousDay}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
              data-testid="button-prev-day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <div className="flex-1 flex items-center justify-center gap-2">
              {datesInView.map((date, idx) => (
                <motion.div 
                  key={date.toISOString()}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "text-center px-3 py-1 rounded-lg",
                    isSameDay(date, new Date()) && "bg-primary/10"
                  )}
                >
                  <h1 className="text-sm font-bold">
                    {format(date, 'EEEE', { locale: he })}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {format(date, 'd/M')}
                  </p>
                </motion.div>
              ))}
            </div>
            
            <button 
              onClick={goToNextDay}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
              data-testid="button-next-day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center pb-2">
            <PlanMyDayButton
              date={selectedDate}
              tasks={getTasksForDay(selectedDate)}
            />
          </div>
        </header>

        {(() => {
          const allDayByDate = datesInView.map(date => ({
            date,
            tasks: getTasksForDay(date).filter(t => t.isAllDay),
          })).filter(d => d.tasks.length > 0);
          if (allDayByDate.length === 0) return null;
          return (
            <div className="sticky top-0 z-10 border-b border-border bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 flex gap-2 flex-wrap" data-testid="allday-strip">
              <div className="w-14 flex-shrink-0 flex items-center">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">כל היום</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5">
                {allDayByDate.map(({ date, tasks }) =>
                  tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => navigate(`/task/${task.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                      data-testid={`allday-task-${task.id}`}
                    >
                      {task.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        <div 
          ref={timelineRef}
          className="flex-1 overflow-y-auto pb-20"
        >
          <div className="flex" ref={containerRef}>
            <div className="w-14 flex-shrink-0 sticky left-0 bg-background z-20">
              {HOURS.map((hour) => (
                <div 
                  key={hour}
                  className="border-b border-border/30 text-left px-1"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-xs font-bold text-muted-foreground">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {datesInView.map((date) => {
              const dayStart = startOfDay(date);
              const allTasks = getTasksForDay(date);
              const tasks = allTasks.filter(t => !t.isAllDay);
              const positions = calculateTaskPositions(tasks, dayStart);
              const isToday = isSameDay(date, currentTime);

              return (
                <div 
                  key={date.toISOString()}
                  className={cn(
                    "flex-1 relative border-r border-border/30",
                    viewDays > 1 && "min-w-[120px]"
                  )}
                >
                  {HOURS.map((hour) => {
                    const isCurrentHour = isToday && isSameHour(addHours(dayStart, hour), currentTime);

                    return (
                      <div 
                        key={hour}
                        className="border-b border-border/30 relative cursor-pointer hover:bg-secondary/30 transition-colors"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                        onClick={(e) => handleTimeSlotClick(date, hour, e)}
                        data-testid={`timeslot-${format(date, 'yyyy-MM-dd')}-${hour}`}
                      >
                        {isCurrentHour && (
                          <div 
                            className="absolute left-0 right-0 h-0.5 bg-red-500 z-40 pointer-events-none"
                            style={{ top: `${(currentTime.getMinutes() / 60) * 100}%` }}
                          >
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500" />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 bg-background px-1 rounded">
                              {format(currentTime, 'HH:mm')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
                    {(() => {
                      const sortedTasks = [...tasks].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                      const freeSlots: { startMin: number; endMin: number }[] = [];
                      for (let i = 0; i < sortedTasks.length - 1; i++) {
                        const gapStart = differenceInMinutes(sortedTasks[i].endTime, dayStart);
                        const gapEnd   = differenceInMinutes(sortedTasks[i + 1].startTime, dayStart);
                        if (gapEnd - gapStart >= 10) {
                          freeSlots.push({ startMin: gapStart, endMin: gapEnd });
                        }
                      }
                      return freeSlots.map((slot, idx) => {
                        const top        = (slot.startMin / 60) * HOUR_HEIGHT;
                        const height     = ((slot.endMin - slot.startMin) / 60) * HOUR_HEIGHT;
                        const renderedH  = Math.max(height, 16);
                        const gapMinutes = slot.endMin - slot.startMin;
                        const hours      = Math.floor(gapMinutes / 60);
                        const mins       = gapMinutes % 60;
                        const durLabel   = hours > 0
                          ? (mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')} שע'` : `${hours} שע'`)
                          : `${mins} דק'`;
                        const showLabel  = renderedH >= 14;
                        const bigLabel   = renderedH >= 28;
                        return (
                          <div
                            key={`free-${idx}`}
                            className="absolute left-1 right-1 flex items-center justify-center gap-1 pointer-events-auto cursor-pointer rounded-lg border border-dashed border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/25 transition-colors"
                            style={{ top: `${top}px`, height: `${renderedH}px` }}
                            onClick={() => {
                              const slotHour   = Math.floor(slot.startMin / 60);
                              const slotMinute = Math.floor((slot.startMin % 60) / 15) * 15;
                              setCreateTime({ date, hour: slotHour, minute: slotMinute });
                              setNewTaskTitle('');
                              setNewTaskDuration(Math.min(gapMinutes, 60));
                              setShowCreateDialog(true);
                            }}
                            data-testid={`free-slot-${idx}`}
                          >
                            {showLabel && (
                              <span
                                className="text-emerald-700 dark:text-emerald-400 font-medium leading-none tabular-nums select-none"
                                style={{ fontSize: bigLabel ? '10px' : '8px' }}
                              >
                                {bigLabel ? `זמן פנוי · ${durLabel}` : 'פנוי'}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                    {positions.map((pos) => {
                      const isActive = currentTask?.id === pos.task.id;
                      const isDragging = dragState?.taskId === pos.task.id;
                      
                      let adjustedPos = { ...pos };
                      if (isDragging) {
                        adjustedPos.top = pos.top + dragOffset.top;
                        adjustedPos.height = pos.height + dragOffset.height;
                      }
                      
                      return (
                        <div key={pos.task.id} className="pointer-events-auto">
                          <TaskItem
                            task={pos.task}
                            isActive={isActive}
                            position={adjustedPos}
                            onDragStart={handleDragStart}
                            onResizeStart={handleResizeStart}
                            onClick={() => !dragState && navigate(`/task/${pos.task.id}`)}
                            isDragging={isDragging}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>משימה חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createTime && (
              <p className="text-sm text-muted-foreground text-center">
                {format(createTime.date, 'EEEE, d בMMMM', { locale: he })} בשעה {createTime.hour.toString().padStart(2, '0')}:{createTime.minute.toString().padStart(2, '0')}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="task-title">שם המשימה</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="מה צריך לעשות?"
                data-testid="input-new-task-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-duration">משך (דקות)</Label>
              <Input
                id="task-duration"
                type="number"
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(Math.max(15, parseInt(e.target.value) || 60))}
                min={15}
                step={15}
                data-testid="input-new-task-duration"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim()}
              data-testid="button-create-task"
            >
              <Plus className="w-4 h-4 ml-2" />
              צור משימה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DayViewPage;
