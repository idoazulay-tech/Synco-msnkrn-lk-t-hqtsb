import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight, 
  RotateCcw,
  ChevronLeft,
  Brain,
  FileText,
  Calendar,
  Clock,
  Plus,
  CalendarPlus,
  BookOpen,
  Lightbulb,
  MapPin,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InsightsDrawer } from './InsightsDrawer';
import { useTaskStore } from '@/store/taskStore';
import { useMAStore } from '@/store/maStore';
import { useNotificationStore } from '@/store/notificationStore';
import { addMinutes, format } from 'date-fns';

interface TaskOutput {
  title: string;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  participants: string[];
  type: string;
  priority: string;
  flexibility: string;
  notes: string | null;
  source: string;
  confidence: string;
  needs_clarification: boolean;
  clarifying_question: string | null;
}

interface JournalOutput {
  title: string;
  entry_text: string;
  timestamp_local: string;
  tags: string[];
  mood_hint: string;
  intensity: number;
  action_suggestion: string | null;
}

interface SuggestedTask {
  title: string;
  reason: string;
  confidence: string;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictingTasks: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  isRelated: boolean;
  relationReason?: string;
  reorganizationQuestion?: string;
}

interface InterpretResult {
  mode: 'task_or_event' | 'journal_entry';
  task: TaskOutput | null;
  journal: JournalOutput | null;
  suggested_tasks_from_journal: SuggestedTask[];
  learning_log: Record<string, string[]>;
  action?: {
    type: string;
    taskFile?: { id: string; title: string };
    taskRun?: { id: string };
  };
  conflict?: ConflictInfo;
}

interface UnderstandingScreenProps {
  result: InterpretResult;
  originalText: string;
  onReset: () => void;
  onClose: () => void;
}

const modeLabels: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  task_or_event: { label: 'משימה / אירוע', icon: FileText, color: 'text-green-500' },
  journal_entry: { label: 'רשומת יומן', icon: BookOpen, color: 'text-blue-500' },
};

const taskTypeLabels: Record<string, string> = {
  meeting: 'פגישה',
  appointment: 'תור',
  errand: 'סידור',
  task: 'משימה',
  reminder: 'תזכורת',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const priorityLabels: Record<string, string> = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
};

const moodLabels: Record<string, string> = {
  calm: 'רגוע',
  stressed: 'לחוץ',
  angry: 'כועס',
  sad: 'עצוב',
  anxious: 'חרד',
  excited: 'מתרגש',
  tired: 'עייף',
  neutral: 'נייטרלי',
};

export function UnderstandingScreen({ result, originalText, onReset, onClose }: UnderstandingScreenProps) {
  const [showInsights, setShowInsights] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [createdTaskTime, setCreatedTaskTime] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState(format(new Date(), 'HH:mm'));
  const [taskDuration, setTaskDuration] = useState(30);
  const [autoCreated, setAutoCreated] = useState(false);
  const [questionSent, setQuestionSent] = useState(false);
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  const addTask = useTaskStore((state) => state.addTask);
  const addMAMessage = useMAStore((state) => state.addMessage);
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const modeInfo = modeLabels[result.mode] || modeLabels.task_or_event;
  const ModeIcon = modeInfo.icon;
  
  // Generate a unique ID for this result to track if it changed (use action ID or timestamp)
  const resultId = result.action?.taskRun?.id || 
                   result.action?.taskFile?.id || 
                   `${result.task?.title || ''}-${result.task?.start_date || ''}-${result.task?.start_time || ''}` ||
                   `${result.journal?.timestamp_local || ''}`;
  
  // Reset states when result changes (new input analyzed)
  useEffect(() => {
    if (resultId && resultId !== lastResultId) {
      setAutoCreated(false);
      setQuestionSent(false);
      setLastResultId(resultId);
    }
  }, [resultId, lastResultId]);

  // Auto-create task when MA is confident (high confidence + task created on server)
  useEffect(() => {
    if (result.action?.type === 'TASK_CREATED' && result.task && !autoCreated) {
      const now = new Date();
      let startTime: Date;
      let endTime: Date;
      let taskStatus: 'pending' | 'in_progress' = 'pending';
      
      if (result.task.start_date) {
        const dateParts = result.task.start_date.split('-').map(Number);
        if (dateParts.length === 3) {
          const [year, month, day] = dateParts;
          if (result.task.start_time) {
            const timeParts = result.task.start_time.split(':').map(Number);
            const [hours, minutes] = timeParts;
            startTime = new Date(year, month - 1, day, hours, minutes);
          } else {
            startTime = new Date(year, month - 1, day, 12, 0);
          }
          
          // Use end_time from result if available
          if (result.task.end_time) {
            const endTimeParts = result.task.end_time.split(':').map(Number);
            const [endHours, endMinutes] = endTimeParts;
            endTime = new Date(year, month - 1, day, endHours, endMinutes);
          } else {
            endTime = addMinutes(startTime, 30);
          }
        } else {
          startTime = now;
          endTime = addMinutes(now, 30);
          taskStatus = 'in_progress';
        }
      } else {
        startTime = now;
        endTime = addMinutes(now, 30);
        taskStatus = 'in_progress';
      }
      
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      
      addTask({
        title: result.task.title,
        startTime,
        endTime,
        duration,
        status: taskStatus,
        tags: [],
        location: result.task.location || undefined,
      });
      
      // Send success notification
      const timeStr = startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      addNotification({
        type: 'success',
        title: 'משימה נוצרה',
        message: `"${result.task.title}" נוספה ללוח בשעה ${timeStr}`,
      });
      
      setAutoCreated(true);
      setTaskCreated(true);
      setCreatedTaskTime(timeStr);
    }
  }, [result, autoCreated, addTask, addNotification]);

  // Send clarifying questions to MA store for display in ארגון page
  useEffect(() => {
    if (result.task?.needs_clarification && result.task.clarifying_question && !questionSent) {
      // Check if this is a conflict question
      if (result.conflict?.hasConflict) {
        addMAMessage({
          type: 'conflict',
          text: result.task.clarifying_question,
          taskTitle: result.task.title,
          conflict: result.conflict,
          newTaskInfo: result.task.start_date && result.task.start_time ? {
            title: result.task.title,
            startTime: `${result.task.start_date}T${result.task.start_time}`,
            endTime: result.task.end_time 
              ? `${result.task.start_date}T${result.task.end_time}` 
              : `${result.task.start_date}T${result.task.start_time}`,
          } : undefined,
        });
        
        // Also send a notification about the conflict
        addNotification({
          type: 'conflict',
          title: 'זוהתה חפיפה בלוח',
          message: `"${result.task.title}" מתנגש עם משימות קיימות. יש לבדוק בדף הארגון.`,
        });
      } else {
        addMAMessage({
          type: 'question',
          text: result.task.clarifying_question,
          taskTitle: result.task.title,
        });
      }
      setQuestionSent(true);
    }
  }, [result, questionSent, addMAMessage, addNotification]);
  
  const wasTaskCreated = result.action?.type === 'TASK_CREATED' || taskCreated;
  const canCreateTask = result.mode === 'task_or_event' && result.task && !wasTaskCreated;
  const isJournal = result.mode === 'journal_entry';

  const handleConfirmTask = (useCustomTime = false) => {
    if (!result.task) return;
    
    const title = result.task.title;
    const now = new Date();
    
    let startTime: Date;
    let taskStatus: 'pending' | 'in_progress' = 'pending';
    const duration = Math.max(5, taskDuration || 30);
    
    if (useCustomTime) {
      if (!selectedDate || !selectedTime) return;
      const dateParts = selectedDate.split('-');
      const timeParts = selectedTime.split(':');
      if (dateParts.length !== 3 || timeParts.length !== 2) return;
      const [year, month, day] = dateParts.map(Number);
      const [hours, minutes] = timeParts.map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return;
      startTime = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(startTime.getTime())) return;
      if (startTime <= now) taskStatus = 'in_progress';
    } else if (result.task.start_date) {
      const dateParts = result.task.start_date.split('-').map(Number);
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts;
        if (result.task.start_time) {
          const timeParts = result.task.start_time.split(':').map(Number);
          const [hours, minutes] = timeParts;
          startTime = new Date(year, month - 1, day, hours, minutes);
        } else {
          startTime = new Date(year, month - 1, day, 12, 0);
        }
      } else {
        startTime = now;
        taskStatus = 'in_progress';
      }
    } else {
      startTime = now;
      taskStatus = 'in_progress';
    }
    
    const endTime = addMinutes(startTime, duration);
    
    addTask({
      title,
      startTime,
      endTime,
      duration,
      status: taskStatus,
      tags: [],
      location: result.task.location || undefined,
    });
    
    setTaskCreated(true);
    setCreatedTaskTime(startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleConvertSuggestionToTask = (suggestion: SuggestedTask) => {
    const now = new Date();
    const endTime = addMinutes(now, 30);
    
    addTask({
      title: suggestion.title,
      startTime: now,
      endTime,
      duration: 30,
      status: 'in_progress',
      tags: [],
    });
    
    setTaskCreated(true);
    setCreatedTaskTime(now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
  };

  const insightsData = {
    summary: result.mode === 'task_or_event' 
      ? (result.task?.notes || `זוהתה ${taskTypeLabels[result.task?.type || 'task']}`)
      : (result.journal?.action_suggestion || 'רשומת יומן'),
    detected: {
      mode: result.mode,
      taskType: result.task?.type,
      mood: result.journal?.mood_hint,
      confidence: result.task?.confidence,
      tags: result.journal?.tags,
    }
  };

  return (
    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Card className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-full bg-muted", modeInfo.color)}>
              <ModeIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{modeInfo.label}</h3>
              <p className="text-muted-foreground text-sm">
                {result.mode === 'task_or_event' && result.task 
                  ? result.task.title
                  : result.journal?.title}
              </p>
            </div>
          </div>

          {result.mode === 'task_or_event' && result.task && (
            <>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">כותרת:</p>
                <p className="font-medium">{result.task.title}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="secondary"
                  className={cn("gap-1", priorityColors[result.task.priority], "text-white")}
                >
                  דחיפות: {priorityLabels[result.task.priority]}
                </Badge>
                
                {result.task.start_date && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(result.task.start_date).toLocaleDateString('he-IL')}
                  </Badge>
                )}

                {result.task.start_time && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {result.task.start_time}
                  </Badge>
                )}

                {result.task.type !== 'task' && (
                  <Badge variant="outline" className="gap-1">
                    {taskTypeLabels[result.task.type]}
                  </Badge>
                )}

                {result.task.location && (
                  <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-900/20">
                    <MapPin className="h-3 w-3" />
                    {result.task.location}
                  </Badge>
                )}

                {result.task.participants.length > 0 && (
                  <Badge variant="outline" className="gap-1 bg-purple-50 dark:bg-purple-900/20">
                    <Users className="h-3 w-3" />
                    {result.task.participants.join(', ')}
                  </Badge>
                )}

                {result.task.confidence && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "gap-1",
                      result.task.confidence === 'high' && "border-green-500 text-green-600",
                      result.task.confidence === 'medium' && "border-yellow-500 text-yellow-600",
                      result.task.confidence === 'low' && "border-red-500 text-red-600"
                    )}
                  >
                    ביטחון: {result.task.confidence === 'high' ? 'גבוה' : result.task.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                  </Badge>
                )}
              </div>

              {result.task.notes && (
                <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                  {result.task.notes}
                </div>
              )}
            </>
          )}

          {isJournal && result.journal && (
            <>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">רשומה:</p>
                <p className="font-medium text-sm">{result.journal.entry_text}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  מצב רוח: {moodLabels[result.journal.mood_hint]}
                </Badge>
                
                <Badge variant="outline" className="gap-1">
                  עוצמה: {result.journal.intensity}/5
                </Badge>

                {result.journal.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {tag}
                  </Badge>
                ))}
              </div>

              {result.journal.action_suggestion && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <Lightbulb className="h-5 w-5 text-blue-500" />
                  <span className="text-blue-700 dark:text-blue-400 text-sm">
                    {result.journal.action_suggestion}
                  </span>
                </div>
              )}

              {result.suggested_tasks_from_journal.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">משימות מוצעות:</p>
                  {result.suggested_tasks_from_journal.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{suggestion.title}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConvertSuggestionToTask(suggestion)}
                        data-testid={`button-add-suggestion-${index}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {wasTaskCreated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20"
            >
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-green-700 dark:text-green-400 font-medium">
                משימה נוצרה בהצלחה!
                {createdTaskTime && ` (${createdTaskTime})`}
              </span>
            </motion.div>
          )}

          {canCreateTask && !showScheduleForm && (
            <div className="space-y-2">
              <Button
                onClick={() => handleConfirmTask(false)}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-confirm-task"
              >
                <Plus className="h-4 w-4 ml-2" />
                אישור והוספה ללוח זמנים
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowScheduleForm(true)}
                className="w-full"
                data-testid="button-schedule-custom"
              >
                <CalendarPlus className="h-4 w-4 ml-2" />
                בחר תאריך ושעה
              </Button>
            </div>
          )}

          {showScheduleForm && !wasTaskCreated && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-muted/30 rounded-lg border"
            >
              <h4 className="font-medium text-sm">תזמון משימה</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="task-date">תאריך</Label>
                  <Input
                    id="task-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    data-testid="input-task-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-time">שעה</Label>
                  <Input
                    id="task-time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    data-testid="input-task-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-duration">משך (דקות)</Label>
                <Input
                  id="task-duration"
                  type="number"
                  min={5}
                  max={480}
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(Number(e.target.value))}
                  data-testid="input-task-duration"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowScheduleForm(false)}
                  className="flex-1"
                  data-testid="button-cancel-schedule"
                >
                  ביטול
                </Button>
                <Button
                  onClick={() => handleConfirmTask(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-confirm-scheduled-task"
                >
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף ללוח
                </Button>
              </div>
            </motion.div>
          )}

          {result.task?.needs_clarification && result.task.clarifying_question && !wasTaskCreated && (
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20"
              >
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <span className="text-orange-700 dark:text-orange-400 font-medium">
                  {result.task.clarifying_question}
                </span>
              </motion.div>
            </div>
          )}
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onReset}
            className="flex-1"
            data-testid="button-reset"
          >
            <RotateCcw className="h-4 w-4 ml-2" />
            קלט חדש
          </Button>
          
          <Button
            onClick={onClose}
            className="flex-1"
            data-testid="button-done"
          >
            <ArrowRight className="h-4 w-4 ml-2" />
            סיום
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => setShowInsights(!showInsights)}
          className="w-full text-muted-foreground"
          data-testid="button-toggle-insights"
        >
          <ChevronLeft className={cn(
            "h-4 w-4 ml-2 transition-transform",
            showInsights && "rotate-90"
          )} />
          תובנות ושיקופים
        </Button>
      </motion.div>

      <InsightsDrawer 
        isOpen={showInsights} 
        insights={insightsData} 
        onClose={() => setShowInsights(false)}
      />
    </div>
  );
}
