import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { format, addDays, subDays, startOfDay, addHours, isSameHour, isSameDay, differenceInMinutes } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 80; // pixels per hour

// Task item component with timer for active tasks
const TaskItem = ({ 
  task, 
  isActive, 
  style,
  isOverlapping,
  onClick 
}: { 
  task: Task; 
  isActive: boolean; 
  style: { top: number; height: number; left?: string; right?: string; zIndex?: number };
  isOverlapping: boolean;
  onClick: () => void;
}) => {
  const { percentage, remainingTime, isUrgent, isWarning } = useTaskTimer(isActive ? task : null);

  const getProgressColor = () => {
    if (isUrgent) return 'bg-timer-urgent';
    if (isWarning) return 'bg-timer-warning';
    return 'bg-timer-progress';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        'absolute rounded-xl cursor-pointer overflow-hidden',
        'transition-all duration-200 hover:ring-2 hover:ring-primary/20',
        isActive 
          ? 'bg-primary text-primary-foreground shadow-lg' 
          : isOverlapping 
            ? 'bg-yellow-500 dark:bg-yellow-600 text-foreground border border-yellow-600 dark:border-yellow-500'
            : 'bg-primary text-primary-foreground border border-primary/50'
      )}
      style={{
        top: `${style.top}px`,
        height: `${Math.max(style.height, 56)}px`,
        left: style.left || '8px',
        right: style.right || '16px',
        zIndex: style.zIndex || 1,
      }}
    >
      <div className="flex items-start justify-between p-3 gap-3">
        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm md:text-base font-semibold truncate',
            (isActive || !isOverlapping) && 'text-primary-foreground',
            isOverlapping && !isActive && 'text-yellow-900 dark:text-yellow-100'
          )}>
            {task.title}
          </p>
          {task.location && (
            <p className={cn(
              'text-xs truncate mt-0.5',
              (isActive || !isOverlapping) ? 'text-primary-foreground/80' : 'text-yellow-800 dark:text-yellow-200'
            )}>
              {task.location}
            </p>
          )}
        </div>

        {/* Timer stats for active task - 20% larger */}
        {isActive && (
          <div className="flex-shrink-0 text-right">
            <p className={cn(
              'text-xl md:text-2xl font-bold tabular-nums',
              isUrgent ? 'text-destructive' : 'text-primary-foreground'
            )}>
              {Math.round(percentage)}%
            </p>
            <p className="text-sm text-primary-foreground/80 tabular-nums">
              {remainingTime}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar for active task - at bottom of card */}
      {isActive && (
        <div className="w-full h-2 bg-primary-foreground/20 border-t border-foreground/20">
          <motion.div
            className={cn('h-full', getProgressColor())}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
    </motion.div>
  );
};

// Helper to check if two tasks overlap
const tasksOverlap = (task1: Task, task2: Task): boolean => {
  return task1.startTime < task2.endTime && task2.startTime < task1.endTime;
};

// Helper to get task duration in minutes
const getTaskDuration = (task: Task): number => {
  return differenceInMinutes(task.endTime, task.startTime);
};

const DayViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Get date from navigation state or use today
  const getInitialDate = () => {
    if (location.state?.date) {
      return new Date(location.state.date);
    }
    return new Date();
  };
  
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const { getTasksForDay, getCurrentTask } = useTaskStore();
  const tasks = getTasksForDay(selectedDate);
  const currentTask = getCurrentTask();

  // Calculate task positions and overlapping info
  const processedTasks = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    
    // Sort tasks by duration (longest first) then by start time
    const sortedTasks = [...tasks].sort((a, b) => {
      const durationDiff = getTaskDuration(b) - getTaskDuration(a);
      if (durationDiff !== 0) return durationDiff;
      return a.startTime.getTime() - b.startTime.getTime();
    });

    // Find the longest task for each overlapping group
    const longestTaskIds = new Set<string>();
    const processed: { task: Task; isOverlapping: boolean; style: { top: number; height: number; left?: string; right?: string; zIndex?: number } }[] = [];
    
    // Group overlapping tasks and mark the longest one
    for (const task of sortedTasks) {
      const overlappingWithLonger = sortedTasks.some(
        other => other.id !== task.id && 
                 tasksOverlap(task, other) && 
                 getTaskDuration(other) > getTaskDuration(task)
      );
      
      if (!overlappingWithLonger) {
        longestTaskIds.add(task.id);
      }
    }

    // Calculate positions for each task
    for (const task of tasks) {
      const startMinutes = differenceInMinutes(task.startTime, dayStart);
      const endMinutes = differenceInMinutes(task.endTime, dayStart);
      const durationMinutes = endMinutes - startMinutes;
      
      const top = (startMinutes / 60) * HOUR_HEIGHT;
      const height = (durationMinutes / 60) * HOUR_HEIGHT;
      
      const isLongest = longestTaskIds.has(task.id);
      const hasOverlap = tasks.some(other => other.id !== task.id && tasksOverlap(task, other));
      
      // If overlapping and not the longest, offset position slightly
      const style: { top: number; height: number; left?: string; right?: string; zIndex?: number } = {
        top,
        height,
      };
      
      if (hasOverlap && !isLongest) {
        // Shorter overlapping tasks get offset and higher z-index
        style.left = '24px';
        style.right = '8px';
        style.zIndex = 10;
      } else {
        style.left = '8px';
        style.right = '16px';
        style.zIndex = isLongest ? 5 : 1;
      }
      
      processed.push({
        task,
        isOverlapping: hasOverlap && !isLongest,
        style,
      });
    }
    
    return processed;
  }, [tasks, selectedDate]);

  // Get task info for a specific hour (for hour label coloring)
  const getTaskAtHour = (hour: number): { hasTask: boolean; isYellow: boolean } => {
    const hourStart = addHours(startOfDay(selectedDate), hour);
    const hourEnd = addHours(hourStart, 1);
    
    for (const { task, isOverlapping } of processedTasks) {
      // Check if task covers this hour
      if (task.startTime < hourEnd && task.endTime > hourStart) {
        return { hasTask: true, isYellow: isOverlapping };
      }
    }
    return { hasTask: false, isYellow: false };
  };

  // Auto-scroll to current hour on mount and when viewing today
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

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));

  // Swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isRightSwipe) {
      goToPreviousDay(); // Swipe right = earlier date
    } else if (isLeftSwipe) {
      goToNextDay(); // Swipe left = later date
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button 
              onClick={goToPreviousDay}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            <motion.div 
              key={selectedDate.toISOString()}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="text-xl font-bold">
                {format(selectedDate, 'EEEE', { locale: he })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'd בMMMM yyyy', { locale: he })}
              </p>
            </motion.div>
            
            <button 
              onClick={goToNextDay}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Timeline with swipe support */}
        <div 
          ref={timelineRef}
          className="flex-1 overflow-y-auto pb-20"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="relative">
            {/* Hour grid lines */}
            {HOURS.map((hour) => {
              const now = new Date();
              const isCurrentHour = isSameHour(addHours(startOfDay(selectedDate), hour), now);
              const taskInfo = getTaskAtHour(hour);

              return (
                <div 
                  key={hour}
                  className="flex border-b border-border/50 relative"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {/* Time label - changes color when task is present */}
                  <div className="w-16 flex-shrink-0 px-2 py-1 text-left relative z-30">
                    <span className={cn(
                      'text-xs font-bold px-1 py-0.5 rounded',
                      taskInfo.hasTask 
                        ? taskInfo.isYellow 
                          ? 'text-black bg-yellow-500/90' 
                          : 'text-white bg-primary/90'
                        : isCurrentHour 
                          ? 'text-primary' 
                          : 'text-muted-foreground'
                    )}>
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Empty task area for grid */}
                  <div className="flex-1 relative">
                    {/* Current time indicator - dark blue, highest z-index for focus */}
                    {isCurrentHour && (
                      <div 
                        className="absolute -left-16 right-0 h-1 bg-blue-900 dark:bg-blue-400 z-50 shadow-lg"
                        style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-900 dark:bg-blue-400 shadow-md" />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-900 dark:bg-blue-400 shadow-md" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Tasks layer - rendered once per task, spanning full duration */}
            <div className="absolute top-0 left-16 right-0 bottom-0 pointer-events-none">
              {processedTasks.map(({ task, isOverlapping, style }) => {
                const isActive = currentTask?.id === task.id;
                
                return (
                  <div key={task.id} className="pointer-events-auto">
                    <TaskItem
                      task={task}
                      isActive={isActive}
                      style={style}
                      isOverlapping={isOverlapping}
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DayViewPage;
