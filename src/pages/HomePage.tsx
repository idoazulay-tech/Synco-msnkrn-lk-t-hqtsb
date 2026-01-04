import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { CircularProgress } from '@/components/timer/CircularProgress';
import { CompletionDialog } from '@/components/timer/CompletionDialog';
import { TaskCard } from '@/components/task/TaskCard';
import { FocusMessageOverlay } from '@/components/focus/FocusMessageOverlay';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { Task } from '@/types/task';

const HomePage = () => {
  const navigate = useNavigate();
  const { getCurrentTask, getTasksForDay, completeTask } = useTaskStore();
  const currentTask = getCurrentTask();
  const todayTasks = getTasksForDay(new Date());
  const upcomingTasks = todayTasks.filter(t => t.id !== currentTask?.id && t.status === 'pending');

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
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
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
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
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

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          {/* Current Task with Timer */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            {/* Timer - above task card */}
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

            {/* Focus Message */}
            <FocusMessageOverlay percentage={percentage} />

            <TaskCard
              task={currentTask}
              variant="large"
              onClick={() => navigate(`/task/${currentTask.id}`)}
              onNavigate={() => navigate('/day')}
            />
          </motion.div>

          {/* Next task preview */}
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

        {/* Completion Dialogs */}
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
      </div>
    </AppLayout>
  );
};

export default HomePage;
