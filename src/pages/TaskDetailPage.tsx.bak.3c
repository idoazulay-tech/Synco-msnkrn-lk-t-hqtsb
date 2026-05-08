import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Clock, Tag, FileText, CalendarDays, Check, Repeat, GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store/taskStore';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { cn } from '@/lib/utils';
import { CompactSchedule, ScheduleToggle } from '@/components/layout/CompactSchedule';
import { isRecurringOccurrence, formatRecurringSummary, getMasterTaskId } from '@/lib/recurringEngine';

const TaskDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { getTaskById, completeTask, getCurrentTask } = useTaskStore();
  const task = id ? getTaskById(id) : undefined;
  const currentTask = getCurrentTask();
  const isActiveTask = task && currentTask && task.id === currentTask.id;
  const isOccurrence = !!id && isRecurringOccurrence(id);
  const isException = !!task?.isOccurrenceException;
  
  const { percentage, remainingTime, isUrgent, isWarning } = useTaskTimer(isActiveTask ? task : null);

  if (!task) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">משימה לא נמצאה</p>
        </div>
      </AppLayout>
    );
  }

  const handleComplete = () => {
    completeTask(task.id, true);
    navigate('/');
  };

  const handleReschedule = () => {
    if (isOccurrence) {
      setShowEditDialog(true);
    } else {
      navigate(`/task/${task.id}/edit`);
    }
  };

  const handleEditOccurrenceOnly = () => {
    setShowEditDialog(false);
    navigate(`/task/${id}/edit?mode=occurrence`);
  };

  const handleEditSeries = () => {
    setShowEditDialog(false);
    const masterId = getMasterTaskId(id!);
    navigate(`/task/${masterId}/edit`);
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <ScheduleToggle onClick={() => setShowSchedule(true)} />

        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            
            <h1 className="text-lg font-bold">פרטי משימה</h1>
            
            <div className="w-10" />
          </div>
        </header>

        <div className="p-6 space-y-6">
          {isActiveTask && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-secondary/50 border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn(
                  'text-2xl font-bold tabular-nums',
                  isUrgent ? 'text-destructive' : 'text-foreground'
                )}>
                  {Math.round(percentage)}%
                </span>
                <span className="text-lg text-muted-foreground tabular-nums">
                  {remainingTime}
                </span>
              </div>
              <div className="w-full h-3 bg-timer-track rounded-full overflow-hidden border border-foreground/20">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    isUrgent ? 'bg-timer-urgent' : isWarning ? 'bg-timer-warning' : 'bg-timer-progress'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-4 h-4 rounded-full mt-1.5 flex-shrink-0',
                task.status === 'in_progress' && 'bg-primary animate-pulse',
                task.status === 'pending' && 'bg-muted-foreground',
                task.status === 'completed' && 'bg-success'
              )} />
              <h2 className="text-2xl font-bold leading-tight">{task.title}</h2>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50"
          >
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">
                {format(task.startTime, 'HH:mm')} - {format(task.endTime, 'HH:mm')}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(task.startTime, 'EEEE, d בMMMM yyyy', { locale: he })}
              </p>
            </div>
          </motion.div>

          {isException && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
              data-testid="badge-occurrence-exception"
            >
              <GitBranch className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">חריג מסדרה חוזרת</p>
                <p className="text-xs text-muted-foreground">מופע זה שונה מהסדרה המקורית</p>
              </div>
            </motion.div>
          )}

          {isOccurrence && !isException && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20"
              data-testid="badge-recurring-occurrence"
            >
              <Repeat className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">↺ מופע של משימה חוזרת</p>
                <p className="text-xs text-muted-foreground">עריכה תשאל אם לשנות מופע זה בלבד או את כל הסדרה</p>
              </div>
            </motion.div>
          )}

          {task.repeat && !isOccurrence && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20"
              data-testid="badge-recurring"
            >
              <Repeat className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">↺ חוזר</p>
                <p className="text-xs text-muted-foreground">{formatRecurringSummary(task.repeat)}</p>
              </div>
            </motion.div>
          )}

          {task.location && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50"
            >
              <MapPin className="w-5 h-5 text-primary" />
              <p className="font-medium">{task.location}</p>
            </motion.div>
          )}

          {task.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">תיאור</span>
              </div>
              <p className="text-foreground leading-relaxed">{task.description}</p>
            </motion.div>
          )}

          {task.tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">תגיות</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: `${tag.color}15`,
                      color: tag.color 
                    }}
                  >
                    {tag.icon && <span>{tag.icon}</span>}
                    {tag.name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {task.history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-muted-foreground">היסטוריה</h3>
              <div className="space-y-2">
                {task.history.slice(-5).reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary/50" />
                    <span className="text-muted-foreground">
                      {format(new Date(entry.timestamp), 'dd/MM HH:mm')}
                    </span>
                    <span>
                      {entry.eventType === 'created' && 'נוצרה'}
                      {entry.eventType === 'modified' && 'עודכנה'}
                      {entry.eventType === 'started' && 'התחילה'}
                      {entry.eventType === 'completed' && 'הושלמה'}
                      {entry.eventType === 'postponed' && 'נדחתה'}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="fixed bottom-20 left-0 right-0 p-4 pr-28 bg-gradient-to-t from-background via-background to-transparent">
          <div className="flex gap-3 max-w-lg mr-auto">
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleReschedule}
              className="flex-1 gap-2"
              data-testid="button-reschedule"
            >
              <CalendarDays className="w-4 h-4" />
              עריכה
            </Button>

            <Button 
              size="lg" 
              onClick={handleComplete} 
              className="flex-1 gap-2 bg-success hover:bg-success/90"
              data-testid="button-complete"
            >
              <Check className="w-4 h-4" />
              סיים משימה
            </Button>
          </div>
        </div>

        {showEditDialog && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={() => setShowEditDialog(false)}
            data-testid="dialog-edit-occurrence"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="w-full max-w-lg bg-background rounded-t-2xl p-6 space-y-4 border-t border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-center">עריכת משימה חוזרת</h2>
              <p className="text-sm text-muted-foreground text-center">
                האם לערוך רק את המופע הזה, או את כל הסדרה?
              </p>
              <div className="space-y-3">
                <Button
                  className="w-full gap-2"
                  onClick={handleEditOccurrenceOnly}
                  data-testid="button-edit-occurrence-only"
                >
                  <GitBranch className="w-4 h-4" />
                  ערוך מופע זה בלבד
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleEditSeries}
                  data-testid="button-edit-series"
                >
                  <Repeat className="w-4 h-4" />
                  ערוך את כל הסדרה
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        <CompactSchedule 
          isOpen={showSchedule} 
          onClose={() => setShowSchedule(false)}
          currentTaskId={task.id}
        />
      </div>
    </AppLayout>
  );
};

export default TaskDetailPage;
