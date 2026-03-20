import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, Loader2, Check, X, Edit2,
  ChevronLeft, Clock, Calendar, AlertTriangle, Zap,
  GripVertical, ArrowRight, Info
} from 'lucide-react';
import { format, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTaskStore } from '@/store/taskStore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Task, TaskPriority, TaskFlexibility } from '@/types/task';

interface ParsedTask {
  id: string;
  title: string;
  date: string;
  hour: number | null;
  minute: number | null;
  duration: number;
  priority: TaskPriority;
  flexibility: TaskFlexibility;
  notes?: string;
  approved: boolean;
  editing: boolean;
}

type PlannerStep = 'input' | 'analyzing' | 'review' | 'scheduling' | 'done';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'דחוף',
  medium: 'רגיל',
  low: 'נמוך',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const FLEX_LABELS: Record<TaskFlexibility, string> = {
  fixed: 'נעוץ',
  flexible: 'גמיש',
  anytime: 'חופשי',
};

const FLEX_COLORS: Record<TaskFlexibility, string> = {
  fixed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  flexible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  anytime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function formatTime(hour: number | null, minute: number | null): string {
  if (hour === null) return 'שעה לא נקבעה';
  return `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ש' ${m}דק'` : `${h} שעות`;
}

export default function PriorityPlannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addTask, getTasksForDay } = useTaskStore();

  const [step, setStep] = useState<PlannerStep>('input');
  const [inputText, setInputText] = useState('');
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceEditingId, setVoiceEditingId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDisplay = format(new Date(), 'EEEE, d בMMMM', { locale: he });

  const existingTasks = getTasksForDay(new Date()).map(t => ({
    title: t.title,
    hour: new Date(t.startTime).getHours(),
    minute: new Date(t.startTime).getMinutes(),
    duration: t.duration,
  }));

  const startListening = useCallback((forEditId?: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: 'זיהוי קולי לא נתמך בדפדפן זה', variant: 'destructive' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      const interim = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      if (forEditId) {
        setTranscript(interim);
      } else {
        setInputText(prev => prev ? prev + ' ' + interim : interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (forEditId) {
        const final = transcript;
        if (final.trim()) {
          applyVoiceEdit(forEditId, final.trim());
        }
        setVoiceEditingId(null);
        setTranscript('');
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceEditingId(null);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    if (forEditId) setVoiceEditingId(forEditId);
  }, [transcript, toast]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const applyVoiceEdit = async (taskId: string, voiceText: string) => {
    try {
      const task = parsedTasks.find(t => t.id === taskId);
      if (!task) return;

      const res = await fetch('/api/planner/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `עדכן את המשימה "${task.title}": ${voiceText}`,
          todayDate: today,
        }),
      });
      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        const updated = data.tasks[0];
        setParsedTasks(prev => prev.map(t =>
          t.id === taskId ? {
            ...t,
            title: updated.title || t.title,
            hour: updated.hour ?? t.hour,
            minute: updated.minute ?? t.minute,
            duration: updated.duration || t.duration,
            priority: updated.priority || t.priority,
            flexibility: updated.flexibility || t.flexibility,
            notes: updated.notes || t.notes,
          } : t
        ));
        toast({ title: 'המשימה עודכנה', description: `"${updated.title || task.title}"` });
      }
    } catch {
      toast({ title: 'שגיאה בעדכון קולי', variant: 'destructive' });
    }
  };

  const analyzeInput = async () => {
    if (!inputText.trim()) return;
    setStep('analyzing');

    try {
      const res = await fetch('/api/planner/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          todayDate: today,
          existingTasks,
        }),
      });

      if (!res.ok) throw new Error('שגיאת שרת');
      const data = await res.json();

      if (!data.tasks || data.tasks.length === 0) {
        toast({ title: 'לא נמצאו משימות בטקסט', variant: 'destructive' });
        setStep('input');
        return;
      }

      const tasksWithIds: ParsedTask[] = data.tasks.map((t: any, i: number) => ({
        id: `planned_${Date.now()}_${i}`,
        title: t.title || 'משימה ללא שם',
        date: t.date || today,
        hour: t.hour ?? null,
        minute: t.minute ?? null,
        duration: t.duration || 30,
        priority: t.priority || 'medium',
        flexibility: t.flexibility || 'flexible',
        notes: t.notes || '',
        approved: false,
        editing: false,
      }));

      setParsedTasks(tasksWithIds);
      setStep('review');
    } catch (err) {
      toast({ title: 'שגיאה בניתוח', description: 'נסה שנית', variant: 'destructive' });
      setStep('input');
    }
  };

  const toggleApprove = (id: string) => {
    setParsedTasks(prev => prev.map(t =>
      t.id === id ? { ...t, approved: !t.approved } : t
    ));
  };

  const removeTask = (id: string) => {
    setParsedTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleEdit = (id: string) => {
    setParsedTasks(prev => prev.map(t =>
      t.id === id ? { ...t, editing: !t.editing } : { ...t, editing: false }
    ));
  };

  const updateField = (id: string, field: keyof ParsedTask, value: any) => {
    setParsedTasks(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const approveAll = () => {
    setParsedTasks(prev => prev.map(t => ({ ...t, approved: true })));
  };

  const scheduleApproved = () => {
    const toSchedule = parsedTasks.filter(t => t.approved);
    if (toSchedule.length === 0) {
      toast({ title: 'לא אושרה אף משימה', description: 'סמן V על המשימות שברצונך לשבץ' });
      return;
    }

    setStep('scheduling');

    setTimeout(() => {
      let scheduled = 0;
      const targetDate = new Date(today);

      toSchedule.forEach(task => {
        let startTime: Date;

        if (task.hour !== null) {
          startTime = setMinutes(setHours(new Date(task.date), task.hour), task.minute ?? 0);
        } else {
          startTime = new Date(targetDate);
          startTime.setHours(9, 0, 0, 0);
        }

        const endTime = addMinutes(startTime, task.duration);

        addTask({
          title: task.title,
          description: task.notes || '',
          startTime,
          endTime,
          duration: task.duration,
          status: 'pending',
          priority: task.priority,
          flexibility: task.flexibility,
          tags: [],
          isAllDay: false,
        });
        scheduled++;
      });

      toast({
        title: `${scheduled} משימות שובצו ביומן`,
        description: `תראה אותן בתצוגת היום`
      });
      setStep('done');
    }, 1200);
  };

  const approvedCount = parsedTasks.filter(t => t.approved).length;

  return (
    <AppLayout
      title="תכנון יום חכם"
      rightAction={
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      }
    >
      <div className="max-w-lg mx-auto pb-28 px-4">

        {/* Step: Input */}
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-4 pt-4"
            >
              <div className="text-center space-y-1 pb-2">
                <p className="text-2xl">🧠</p>
                <h2 className="text-lg font-bold">ספר לסינקו מה יש לך היום</h2>
                <p className="text-sm text-muted-foreground">{todayDisplay}</p>
                {existingTasks.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    יש לך {existingTasks.length} משימות ביומן
                  </p>
                )}
              </div>

              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={`לדוגמה:\n"יש לי פגישה עם לקוח ב-10 לשעה וחצי, אחרי זה צריך לשלוח את הדוח, ואחה"צ לאסוף את הילדים ב-4"`}
                  className="min-h-[160px] text-sm resize-none pl-12"
                  dir="rtl"
                  data-testid="planner-input"
                />
                <button
                  onClick={() => isListening ? stopListening() : startListening()}
                  className={cn(
                    'absolute bottom-3 left-3 p-2 rounded-full transition-all',
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  data-testid="planner-voice-btn"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {isListening && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-sm text-red-500"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  מקשיב...
                </motion.div>
              )}

              <Button
                className="w-full gap-2"
                size="lg"
                onClick={analyzeInput}
                disabled={!inputText.trim()}
                data-testid="planner-analyze-btn"
              >
                <Zap className="w-4 h-4" />
                נתח ותכנן
              </Button>

              {existingTasks.length > 0 && (
                <Card className="p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">ביומן שלך היום:</p>
                  <div className="space-y-1">
                    {existingTasks.slice(0, 4).map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">{formatTime(t.hour, t.minute)}</span>
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {existingTasks.length > 4 && (
                      <p className="text-xs text-muted-foreground">ועוד {existingTasks.length - 4}...</p>
                    )}
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* Step: Analyzing */}
          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl">🧠</span>
                </div>
                <Loader2 className="absolute -inset-1 w-[72px] h-[72px] text-primary animate-spin opacity-40" />
              </div>
              <p className="text-base font-semibold">סינקו מנתח את המשימות...</p>
              <p className="text-sm text-muted-foreground">זה ייקח שנייה</p>
            </motion.div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pt-4"
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="font-bold text-base">סינקו זיהה {parsedTasks.length} משימות</h2>
                  <p className="text-xs text-muted-foreground">ערוך, אשר והסר לפי הצורך</p>
                </div>
                <Button variant="ghost" size="sm" onClick={approveAll} data-testid="approve-all-btn">
                  <Check className="w-4 h-4 ml-1" />
                  אשר הכל
                </Button>
              </div>

              <div className="space-y-2">
                {parsedTasks.map((task, index) => (
                  <TaskReviewCard
                    key={task.id}
                    task={task}
                    index={index}
                    isVoiceEditing={voiceEditingId === task.id}
                    voiceTranscript={voiceEditingId === task.id ? transcript : ''}
                    onToggleApprove={() => toggleApprove(task.id)}
                    onRemove={() => removeTask(task.id)}
                    onToggleEdit={() => toggleEdit(task.id)}
                    onUpdateField={(field, val) => updateField(task.id, field, val)}
                    onStartVoiceEdit={() => startListening(task.id)}
                    onStopVoiceEdit={stopListening}
                    isListening={isListening && voiceEditingId === task.id}
                  />
                ))}
              </div>

              {parsedTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>כל המשימות הוסרו</p>
                  <Button variant="ghost" className="mt-2" onClick={() => setStep('input')}>
                    חזור להתחלה
                  </Button>
                </div>
              )}

              <div className="sticky bottom-20 pt-2">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={scheduleApproved}
                  disabled={approvedCount === 0}
                  data-testid="schedule-approved-btn"
                >
                  <Calendar className="w-4 h-4" />
                  שבץ {approvedCount > 0 ? `${approvedCount} משימות` : ''} ביומן
                  <ArrowRight className="w-4 h-4 mr-auto" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full mt-1 text-muted-foreground"
                  onClick={() => { setStep('input'); setInputText(''); }}
                >
                  התחל מחדש
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step: Scheduling */}
          {step === 'scheduling' && (
            <motion.div
              key="scheduling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <div className="text-5xl animate-bounce">📅</div>
              <p className="text-base font-semibold">משבץ ביומן...</p>
            </motion.div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-4 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-4xl">
                ✅
              </div>
              <h2 className="text-xl font-bold">המשימות שובצו בהצלחה!</h2>
              <p className="text-sm text-muted-foreground">תוכל לראות אותן בתצוגת היום</p>
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate('/day')} className="gap-2">
                  <Calendar className="w-4 h-4" />
                  לתצוגת היום
                </Button>
                <Button variant="outline" onClick={() => {
                  setStep('input');
                  setInputText('');
                  setParsedTasks([]);
                }}>
                  תכנון נוסף
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

interface TaskReviewCardProps {
  task: ParsedTask;
  index: number;
  isVoiceEditing: boolean;
  voiceTranscript: string;
  isListening: boolean;
  onToggleApprove: () => void;
  onRemove: () => void;
  onToggleEdit: () => void;
  onUpdateField: (field: keyof ParsedTask, value: any) => void;
  onStartVoiceEdit: () => void;
  onStopVoiceEdit: () => void;
}

function TaskReviewCard({
  task, index, isVoiceEditing, voiceTranscript, isListening,
  onToggleApprove, onRemove, onToggleEdit, onUpdateField,
  onStartVoiceEdit, onStopVoiceEdit
}: TaskReviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className={cn(
        'overflow-hidden transition-all duration-200',
        task.approved ? 'border-green-400 dark:border-green-600 bg-green-50/30 dark:bg-green-900/10' : '',
      )}>
        {/* Main row */}
        <div className="p-3 flex items-start gap-2">
          {/* Approve checkbox */}
          <button
            onClick={onToggleApprove}
            className={cn(
              'mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
              task.approved
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-muted-foreground/40 hover:border-green-400'
            )}
            data-testid={`approve-task-${task.id}`}
          >
            {task.approved && <Check className="w-3.5 h-3.5" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {task.editing ? (
              <Input
                value={task.title}
                onChange={e => onUpdateField('title', e.target.value)}
                className="text-sm font-medium h-7 mb-1"
                dir="rtl"
                autoFocus
                data-testid={`edit-title-${task.id}`}
              />
            ) : (
              <p className="text-sm font-semibold leading-snug">{task.title}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>
              <Badge className={cn('text-[10px] px-1.5 py-0', FLEX_COLORS[task.flexibility])}>
                {FLEX_LABELS[task.flexibility]}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(task.hour, task.minute)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDuration(task.duration)}
              </span>
            </div>

            {task.notes && !task.editing && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{task.notes}</p>
            )}

            {isVoiceEditing && voiceTranscript && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1 text-xs text-primary italic"
              >
                "{voiceTranscript}"
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={isListening ? onStopVoiceEdit : onStartVoiceEdit}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isVoiceEditing && isListening
                  ? 'bg-red-100 text-red-500 animate-pulse dark:bg-red-900/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              data-testid={`voice-edit-${task.id}`}
            >
              {isVoiceEditing && isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={onToggleEdit}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                task.editing ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              data-testid={`manual-edit-${task.id}`}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              data-testid={`remove-task-${task.id}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Edit panel */}
        <AnimatePresence>
          {task.editing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden"
            >
              <div className="p-3 grid grid-cols-2 gap-2 bg-muted/20">
                {/* Hour */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">שעה</label>
                  <Input
                    type="number"
                    min={0} max={23}
                    value={task.hour ?? ''}
                    onChange={e => onUpdateField('hour', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="שעה"
                    className="h-8 text-sm"
                    data-testid={`edit-hour-${task.id}`}
                  />
                </div>
                {/* Duration */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">משך (דקות)</label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={task.duration}
                    onChange={e => onUpdateField('duration', Number(e.target.value))}
                    className="h-8 text-sm"
                    data-testid={`edit-duration-${task.id}`}
                  />
                </div>
                {/* Priority */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">עדיפות</label>
                  <div className="flex gap-1">
                    {(['high', 'medium', 'low'] as TaskPriority[]).map(p => (
                      <button
                        key={p}
                        onClick={() => onUpdateField('priority', p)}
                        className={cn(
                          'flex-1 text-[10px] py-1 rounded-md border transition-all',
                          task.priority === p ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground'
                        )}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Flexibility */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">גמישות</label>
                  <div className="flex gap-1">
                    {(['fixed', 'flexible', 'anytime'] as TaskFlexibility[]).map(f => (
                      <button
                        key={f}
                        onClick={() => onUpdateField('flexibility', f)}
                        className={cn(
                          'flex-1 text-[10px] py-1 rounded-md border transition-all',
                          task.flexibility === f ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground'
                        )}
                      >
                        {FLEX_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
