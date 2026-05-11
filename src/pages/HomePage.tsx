import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Inbox, Clock, Plus, Check, Eye, Zap, AlertTriangle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, differenceInMinutes, differenceInHours, differenceInDays, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { CircularProgress } from '@/components/timer/CircularProgress';
import { CompletionDialog } from '@/components/timer/CompletionDialog';
import { TaskCard } from '@/components/task/TaskCard';
import { FocusMessageOverlay } from '@/components/focus/FocusMessageOverlay';
import { TaskReportDialog } from '@/components/task/TaskReportDialog';
import { TaskReportIntroDialog, isTaskReportIntroDismissed } from '@/components/task/TaskReportIntroDialog';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { useSettingsStore } from '@/store/settingsStore';
import { buildHomeGuidanceContext } from '@/lib/home/homeGuidanceEngine';
import { Task } from '@/types/task';
import { CompactSchedule, ScheduleToggle } from '@/components/layout/CompactSchedule';

const HARD_BLOCKER_OPTIONS = ['low_energy', 'unclear_first_step', 'too_big', 'resistance', 'dependency_missing'];

const formatTimeUntil = (targetTime: Date): string => {
  const now = new Date();
  const diffMinutes = differenceInMinutes(targetTime, now);
  const diffHours = differenceInHours(targetTime, now);
  const diffDays = differenceInDays(targetTime, now);

  if (diffMinutes < 1) return 'עכשיו';
  if (diffMinutes < 60) return `${diffMinutes} דקות`;
  if (diffHours < 24) {
    const remainingMinutes = diffMinutes % 60;
    return remainingMinutes > 0
      ? `${diffHours} שעות ו-${remainingMinutes} דקות`
      : `${diffHours} שעות`;
  }
  const remainingHours = diffHours % 24;
  return remainingHours > 0 ? `${diffDays} ימים ו-${remainingHours} שעות` : `${diffDays} ימים`;
};

const formatDuration = (startTime: Date, endTime: Date): string => {
  const diffMinutes = differenceInMinutes(endTime, startTime);
  if (diffMinutes < 60) return `${diffMinutes} דק'`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')} שעות` : `${hours} שעות`;
};

const ConfidenceBadge = ({ level }: { level: 'high' | 'medium' | 'low' }) => {
  const labels = { high: 'בטוח', medium: 'משוער', low: 'צריך אימות' };
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[level]}`}>
      {labels[level]}
    </span>
  );
};

const WhyNowBadge = ({ text, confidence }: { text: string; confidence: 'high' | 'medium' | 'low' }) => (
  <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
    <Flag className="w-3 h-3 flex-shrink-0 mt-0.5" />
    <span className="leading-relaxed">{text}</span>
    <ConfidenceBadge level={confidence} />
  </div>
);

const NextTaskBanner = ({ task, onClick }: { task: Task; onClick: () => void }) => {
  const [timeUntil, setTimeUntil] = useState(formatTimeUntil(task.startTime));

  useEffect(() => {
    const interval = setInterval(() => setTimeUntil(formatTimeUntil(task.startTime)), 60000);
    return () => clearInterval(interval);
  }, [task.startTime]);

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
            <span>{format(task.startTime, 'HH:mm')}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{formatDuration(task.startTime, task.endTime)}</span>
          </div>
          <p className="text-sm font-medium text-primary">בעוד {timeUntil}</p>
        </div>
      </div>
    </motion.div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const getCurrentTask = useTaskStore((state) => state.getCurrentTask);
  const getTasksForDay = useTaskStore((state) => state.getTasksForDay);
  const completeTask = useTaskStore((state) => state.completeTask);
  const startTaskExecution = useTaskStore((state) => state.startTaskExecution);
  const { settings } = useSettingsStore();
  const currentTask = getCurrentTask();

  const [showSchedule, setShowSchedule] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportPreselect, setReportPreselect] = useState<string | undefined>(undefined);
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  const [reportPendingAfterIntro, setReportPendingAfterIntro] = useState(false);

  const now = useMemo(() => new Date(), []);

  const guidance = useMemo(() => {
    const todayTasks = getTasksForDay(now);
    return buildHomeGuidanceContext({
      tasks: todayTasks,
      now,
      settings: {
        dayStart: settings?.dayStart,
        dayEnd: settings?.dayEnd,
        timezone: settings?.timezone,
        planningStyle: settings?.planningStyle,
      },
    });
  }, [tasks, now, settings, getTasksForDay]);

  const nextTask = useMemo(() => {
    let allUpcoming: Task[] = [];
    for (let i = 0; i < 30; i++) {
      const dayTasks = getTasksForDay(addDays(now, i));
      allUpcoming = [...allUpcoming, ...dayTasks];
    }
    return (
      allUpcoming
        .filter((t) => t.id !== currentTask?.id && t.status === 'pending' && t.startTime > now)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0] ?? null
    );
  }, [getTasksForDay, currentTask, now]);

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

  const handleComplete = useCallback(
    (completed: boolean) => {
      if (currentTask) {
        completeTask(currentTask.id, completed);
        dismissDialog10();
        dismissDialog5();
        dismissFinalDialog();
        setShowPlanningMode(true);
      }
    },
    [currentTask, completeTask, dismissDialog10, dismissDialog5, dismissFinalDialog]
  );

  const handleStartExecution = useCallback(() => {
    if (currentTask) startTaskExecution(currentTask.id);
  }, [currentTask, startTaskExecution]);

  const openReportDialog = useCallback((preselect?: string) => {
    if (isTaskReportIntroDismissed()) {
      setReportPreselect(preselect);
      setShowReportDialog(true);
    } else {
      setReportPreselect(preselect);
      setReportPendingAfterIntro(true);
      setShowIntroDialog(true);
    }
  }, []);

  const handleIntroClose = useCallback(() => {
    setShowIntroDialog(false);
    if (reportPendingAfterIntro) {
      setReportPendingAfterIntro(false);
      setShowReportDialog(true);
    }
  }, [reportPendingAfterIntro]);

  const handleHardToStart = useCallback(() => {
    openReportDialog(HARD_BLOCKER_OPTIONS[0]);
  }, [openReportDialog]);

  const handleDialogConfirm = () => handleComplete(true);
  const handleDialogDeny = () => handleComplete(false);

  const taskForReport = guidance.currentTask ?? (guidance.nextTask as Task | null);

  if (!currentTask) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-32 relative">
          <ScheduleToggle onClick={() => setShowSchedule(true)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm space-y-4"
          >
            {guidance.settingsNotice && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {guidance.settingsNotice}
              </div>
            )}

            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-12 h-12 text-muted-foreground" />
              </div>

              {guidance.state === 'upcoming' && guidance.nextTask ? (
                <>
                  <p className="text-xs text-muted-foreground mb-1">המשימה הבאה</p>
                  <h1 className="text-xl font-bold text-foreground mb-1">
                    {guidance.nextTask.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mb-1">
                    מתחילה בעוד{' '}
                    <span className="font-medium text-foreground">
                      {guidance.startsInMinutes} דקות
                    </span>
                    {' '}({format(guidance.nextTask.startTime, 'HH:mm')})
                  </p>
                  <WhyNowBadge text={guidance.whyNow.text} confidence={guidance.whyNow.confidence} />
                </>
              ) : guidance.state === 'day_done' ? (
                <>
                  <h1 className="text-2xl font-bold text-foreground mb-2">יום טוב!</h1>
                  <p className="text-muted-foreground mb-1">{guidance.whyNow.text}</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-foreground mb-2">אין משימה פעילה</h1>
                  <p className="text-muted-foreground mb-1">הזמן שלך פנוי כרגע</p>
                </>
              )}
            </div>

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
            <NextTaskBanner task={nextTask} onClick={() => navigate(`/task/${nextTask.id}`)} />
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

        {guidance.settingsNotice && (
          <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {guidance.settingsNotice}
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            <div className="mb-1 text-center">
              <span className="text-xs font-medium text-muted-foreground">מה עכשיו</span>
            </div>

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

            <WhyNowBadge
              text={guidance.whyNow.text}
              confidence={guidance.whyNow.confidence}
            />

            {guidance.minutesRemaining !== null && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                נותרו{' '}
                <span className="font-medium text-foreground">{guidance.minutesRemaining}</span>{' '}
                דקות
              </p>
            )}

            <div className="flex items-center gap-2 mt-4" dir="rtl">
              <Button
                variant="default"
                className="flex-1 gap-1.5 text-sm"
                onClick={() => handleComplete(true)}
                data-testid="button-complete-task"
              >
                <Check className="w-4 h-4" />
                סיימתי
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-sm"
                onClick={() => openReportDialog()}
                data-testid="button-report-task"
              >
                דיווח
              </Button>
            </div>

            <div className="flex items-center gap-2 mt-2" dir="rtl">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 gap-1.5 text-xs text-muted-foreground"
                onClick={handleHardToStart}
                data-testid="button-hard-to-start"
              >
                קשה לי להתחיל
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={() => navigate(`/task/${currentTask.id}`)}
                data-testid="button-task-details"
              >
                <Eye className="w-3.5 h-3.5" />
                פרטים
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={handleStartExecution}
                data-testid="button-start-task"
              >
                התחל
              </Button>
            </div>
          </motion.div>
        </div>

        {nextTask && (
          <NextTaskBanner task={nextTask} onClick={() => navigate(`/task/${nextTask.id}`)} />
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

        <AnimatePresence>
          {showIntroDialog && (
            <TaskReportIntroDialog onClose={handleIntroClose} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showReportDialog && taskForReport && (
            <TaskReportDialog
              task={taskForReport}
              onClose={() => setShowReportDialog(false)}
              preselectedOption={reportPreselect}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default HomePage;
