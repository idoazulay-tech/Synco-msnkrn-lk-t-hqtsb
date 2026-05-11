import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Inbox, Clock, Plus, Check, X, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, differenceInMinutes, differenceInHours, differenceInDays, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { CircularProgress } from '@/components/timer/CircularProgress';
import { CompletionDialog } from '@/components/timer/CompletionDialog';
import { TaskCard } from '@/components/task/TaskCard';
import { FocusMessageOverlay } from '@/components/focus/FocusMessageOverlay';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { Task } from '@/types/task';
import { CompactSchedule, ScheduleToggle } from '@/components/layout/CompactSchedule';

const formatTimeUntil = (targetTime: Date): string => {
  const now = new Date();
  const diffMinutes = differenceInMinutes(targetTime, now);
  const diffHours = differenceInHours(targetTime, now);
  const diffDays = differenceInDays(targetTime, now);

  if (diffMinutes < 1) {
    return 'עכשיו';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} דקות`;
  } else if (diffHours < 24) {
    const hours = diffHours;
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `${hours} שעות ו-${remainingMinutes} דקות`;
    }
    return `${hours} שעות`;
  } else {
    const days = diffDays;
    const remainingHours = diffHours % 24;
    if (remainingHours > 0) {
      return `${days} ימים ו-${remainingHours} שעות`;
    }
    return `${days} ימים`;
  }
};

const formatDuration = (startTime: Date, endTime: Date): string => {
  const diffMinutes = differenceInMinutes(endTime, startTime);
  if (diffMinutes < 60) {
    return `${diffMinutes} דק'`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
  }
  return `${hours} שעות`;
};

const NextTaskBanner = ({ task, onClick }: { task: Task; onClick: () => void }) => {
  const [timeUntil, setTimeUntil] = useState(formatTimeUntil(task.startTime));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntil(formatTimeUntil(task.startTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [task.startTime]);

  const duration = formatDuration(task.startTime, task.endTime);
  const taskTime = format(task.startTime, 'HH:mm');

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-20 left-4 right-28 z-20"
    >
      <div 
        onClick={onClick}
        className="bg-secondary/95 backdrop-blur-sm rounded-xl p-4 shadow-lg cursor-pointer hover-elevate"
        data-testid="next-task-banner"
      >
        <p className="text-sm text-muted-foreground mb-2">
          המשימה הבאה: <span className="font-medium text-foreground">"{task.title}"</span>
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{taskTime}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{duration}</span>
          </div>
          <p className="text-sm font-medium text-primary">
            בעוד {timeUntil}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  // Subscribe to tasks array to trigger re-render when tasks change
  const tasks = useTaskStore((state) => state.tasks);
  const getCurrentTask = useTaskStore((state) => state.getCurrentTask);
  const getTasksForDay = useTaskStore((state) => state.getTasksForDay);
  const completeTask = useTaskStore((state) => state.completeTask);
  const currentTask = getCurrentTask();

  const [showSchedule, setShowSchedule] = useState(false);

  const nextTask = useMemo(() => {
    const now = new Date();
    const futureDays = 30;
    
    let allUpcomingTasks: Task[] = [];
    for (let i = 0; i < futureDays; i++) {
      const date = addDays(now, i);
      const dayTasks = getTasksForDay(date);
      allUpcomingTasks = [...allUpcomingTasks, ...dayTasks];
    }
    
    const futureTasksFiltered = allUpcomingTasks
      .filter(t => t.id !== currentTask?.id && t.status === 'pending' && t.startTime > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    return futureTasksFiltered[0] || null;
  }, [getTasksForDay, currentTask]);

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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-32 relative">
          <ScheduleToggle onClick={() => setShowSchedule(true)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Inbox className="w-12 h-12 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">אין משימה פעילה</h1>
            <p className="text-muted-foreground mb-6">הזמן שלך פנוי כרגע</p>
            <div className="flex flex-col gap-2 items-center">
              <Button
                size="lg"
                onClick={() => navigate('/planner')}
                className="gap-2 w-full"
                data-testid="button-plan-day"
              >
                <Zap className="w-5 h-5" />
                תכנן את היום
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/add')}
                className="gap-2 w-full"
                data-testid="button-add-task-empty"
              >
                <Plus className="w-5 h-5" />
                הוסף משימה
              </Button>
            </div>
          </motion.div>

          {nextTask && (
            <NextTaskBanner 
              task={nextTask} 
              onClick={() => navigate(`/task/${nextTask.id}`)} 
            />
          )}

          <CompactSchedule 
            isOpen={showSchedule} 
            onClose={() => setShowSchedule(false)}
            currentTaskId={currentTask?.id}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col relative pb-32">
        <ScheduleToggle onClick={() => setShowSchedule(true)} />

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

        <div className="flex-1 flex flex-col items-center justify-center px-6">
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

            <div className="flex items-center gap-3 mt-4" dir="rtl">
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={() => handleComplete(true)}
                data-testid="button-complete-task"
              >
                <Check className="w-4 h-4" />
                בוצע
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => navigate(`/task/${currentTask.id}/edit`)}
                data-testid="button-dismiss-task"
              >
                <Calendar className="w-4 h-4" />
                דחה / הזז
              </Button>
              <Button
                variant="ghost"
                className="gap-1"
                onClick={() => navigate(`/task/${currentTask.id}`)}
                data-testid="button-task-details"
              >
                <Eye className="w-4 h-4" />
                פרטים
              </Button>
            </div>
          </motion.div>
        </div>

        {nextTask && (
          <NextTaskBanner 
            task={nextTask} 
            onClick={() => navigate(`/task/${nextTask.id}`)} 
          />
        )}

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
          isOpen={showSchedule} 
          onClose={() => setShowSchedule(false)}
          currentTaskId={currentTask.id}
        />
      </div>
    </AppLayout>
  );
};

export default HomePage;
