import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addHours, startOfDay, isSameHour, differenceInMinutes } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { CircularProgress } from '@/components/timer/CircularProgress';
import { CompletionDialog } from '@/components/timer/CompletionDialog';
import { TaskCard } from '@/components/task/TaskCard';
import { FocusMessageOverlay } from '@/components/focus/FocusMessageOverlay';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';

const MINI_HOUR_HEIGHT = 40;

const CompactSchedule = ({ 
  tasks, 
  currentTask, 
  isOpen, 
  onClose 
}: { 
  tasks: Task[]; 
  currentTask: Task | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const now = new Date();
  const currentHour = now.getHours();
  const dayStart = startOfDay(now);
  
  const visibleHours = Array.from({ length: 8 }, (_, i) => Math.min(23, currentHour - 1 + i));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 w-24 bg-background/95 backdrop-blur-sm border-l border-border z-40 shadow-xl"
        >
          <div className="h-full flex flex-col">
            <button
              onClick={onClose}
              className="p-2 border-b border-border flex items-center justify-center hover:bg-secondary transition-colors"
              data-testid="button-close-schedule"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {visibleHours.map((hour) => {
                  const isCurrentHour = hour === currentHour;
                  const tasksInHour = tasks.filter(task => {
                    const taskStartHour = task.startTime.getHours();
                    const taskEndHour = task.endTime.getHours();
                    return hour >= taskStartHour && hour < taskEndHour;
                  });

                  return (
                    <div 
                      key={hour}
                      className={cn(
                        "relative border-b border-border/30",
                        isCurrentHour && "bg-primary/5"
                      )}
                      style={{ height: `${MINI_HOUR_HEIGHT}px` }}
                    >
                      <span className="absolute top-0 left-1 text-[10px] text-muted-foreground">
                        {hour.toString().padStart(2, '0')}
                      </span>
                      
                      {isCurrentHour && (
                        <div 
                          className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                          style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="absolute top-0 left-8 right-1">
                  {tasks.filter(task => {
                    const taskHour = task.startTime.getHours();
                    return taskHour >= visibleHours[0] && taskHour <= visibleHours[visibleHours.length - 1];
                  }).map(task => {
                    const startMinutes = differenceInMinutes(task.startTime, addHours(dayStart, visibleHours[0]));
                    const durationMinutes = differenceInMinutes(task.endTime, task.startTime);
                    const top = (startMinutes / 60) * MINI_HOUR_HEIGHT;
                    const height = (durationMinutes / 60) * MINI_HOUR_HEIGHT;
                    const isActive = currentTask?.id === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/task/${task.id}`)}
                        className={cn(
                          "absolute left-0 right-0 rounded px-1 text-[8px] truncate cursor-pointer",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-secondary text-secondary-foreground"
                        )}
                        style={{
                          top: `${Math.max(0, top)}px`,
                          height: `${Math.max(16, height)}px`,
                        }}
                        data-testid={`mini-task-${task.id}`}
                      >
                        {task.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/day')}
              className="p-2 border-t border-border text-[10px] text-center text-primary hover:bg-secondary transition-colors"
              data-testid="button-open-full-calendar"
            >
              לוח מלא
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const { getCurrentTask, getTasksForDay, completeTask } = useTaskStore();
  const currentTask = getCurrentTask();
  const todayTasks = getTasksForDay(new Date());
  const upcomingTasks = todayTasks.filter(t => t.id !== currentTask?.id && t.status === 'pending');

  const [showSchedule, setShowSchedule] = useState(false);

  const {
    percentage,
    remainingTime,
    isUrgent,
    isWarning,
    shouldShowDialog10,
    shouldShowDialog5,
    shouldShowFinalDialog,
    dismissDialog10,
    dismissDialog5,
    dismissFinalDialog,
  } = useTaskTimer(currentTask);

  const [showPlanningMode, setShowPlanningMode] = useState(false);

  const handleComplete = (completed: boolean) => {
    if (currentTask) {
      completeTask(currentTask.id, completed);
      dismissDialog10();
      dismissDialog5();
      dismissFinalDialog();
      setShowPlanningMode(true);
    }
  };

  const handleDialogConfirm = () => handleComplete(true);
  const handleDialogDeny = () => handleComplete(false);

  if (!currentTask) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
          <button
            onClick={() => setShowSchedule(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 bg-secondary/80 hover:bg-secondary p-1 rounded-l-lg shadow-md z-30 transition-colors"
            data-testid="button-open-schedule"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Inbox className="w-12 h-12 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">אין משימה פעילה</h1>
            <p className="text-muted-foreground mb-8">הזמן שלך פנוי כרגע</p>
            
            {upcomingTasks.length > 0 && (
              <div className="w-full max-w-sm">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 text-right">
                  משימות קרובות
                </h3>
                <div className="space-y-3">
                  {upcomingTasks.slice(0, 3).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      variant="compact"
                      onClick={() => navigate(`/task/${task.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          <CompactSchedule 
            tasks={todayTasks} 
            currentTask={currentTask}
            isOpen={showSchedule} 
            onClose={() => setShowSchedule(false)} 
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col relative">
        <button
          onClick={() => setShowSchedule(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-secondary/80 hover:bg-secondary p-1 rounded-l-lg shadow-md z-30 transition-colors"
          data-testid="button-open-schedule"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <header className="p-4 flex items-center justify-between">
          <button 
            onClick={() => navigate('/day')}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <Calendar className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, d בMMMM', { locale: he })}
            </p>
          </div>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className={`mb-2 ${isUrgent ? 'animate-countdown-pulse' : ''}`}
            >
              <CircularProgress
                percentage={percentage}
                remainingTime={remainingTime}
                isUrgent={isUrgent}
                isWarning={isWarning}
              />
            </motion.div>

            <FocusMessageOverlay percentage={percentage} />

            <TaskCard
              task={currentTask}
              variant="large"
              onClick={() => navigate(`/task/${currentTask.id}`)}
              onNavigate={() => navigate('/day')}
            />
          </motion.div>

          {upcomingTasks.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 w-full max-w-sm"
            >
              <p className="text-sm text-muted-foreground mb-2">הבא:</p>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm font-medium truncate">{upcomingTasks[0].title}</span>
                <span className="text-xs text-muted-foreground mr-auto">
                  {format(upcomingTasks[0].startTime, 'HH:mm')}
                </span>
              </div>
            </motion.div>
          )}
        </div>

        <CompletionDialog
          isOpen={shouldShowDialog10 || shouldShowDialog5}
          onConfirm={handleDialogConfirm}
          onDeny={shouldShowDialog10 ? dismissDialog10 : dismissDialog5}
          onDismiss={shouldShowDialog10 ? dismissDialog10 : dismissDialog5}
          taskTitle={currentTask.title}
        />

        <CompletionDialog
          isOpen={shouldShowFinalDialog}
          onConfirm={handleDialogConfirm}
          onDeny={handleDialogDeny}
          isFinal={true}
          taskTitle={currentTask.title}
        />

        <CompactSchedule 
          tasks={todayTasks} 
          currentTask={currentTask}
          isOpen={showSchedule} 
          onClose={() => setShowSchedule(false)} 
        />
      </div>
    </AppLayout>
  );
};

export default HomePage;
