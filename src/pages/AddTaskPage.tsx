import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mic, MicOff, MapPin, Clock, Tag, FileText, X, Calendar, Archive, AlertCircle, ChevronDown, ChevronUp, Repeat, Sun } from 'lucide-react';
import { format, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeWheelPicker } from '@/components/ui/time-wheel-picker';
import { DurationPresets } from '@/components/ui/duration-presets';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaskStore } from '@/store/taskStore';
import { useNotificationStore } from '@/store/notificationStore';
import { DEFAULT_TAGS, Tag as TagType, Task, RecurringRule, RepeatFrequency, RepeatEndType } from '@/types/task';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { HaMekolel } from '@/components/task/HaMekolel';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { ParsedDateTime } from '@/lib/hebrewDateParser';
import { formatRecurringSummary } from '@/lib/recurringEngine';

const AddTaskPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addTask, addTemplate, templateCategories, tasks } = useTaskStore();
  const { addNotification, settings } = useNotificationStore();
  const { toast } = useToast();

  const initialMode = searchParams.get('mode') === 'cabinet' ? 'cabinet' : 'calendar';
  const [mode, setMode] = useState<'calendar' | 'cabinet'>(initialMode);
  const [showVoiceInput, setShowVoiceInput] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  
  const [startHour, setStartHour] = useState(() => {
    const hour = new Date().getHours();
    return hour > 23 ? 8 : hour;
  });
  const [startMinute, setStartMinute] = useState(() => {
    return Math.floor(new Date().getMinutes() / 5) * 5;
  });
  const [durationMinutes, setDurationMinutes] = useState(60);
  
  const [showStartPicker, setShowStartPicker] = useState(true);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [conflicts, setConflicts] = useState<Task[]>([]);
  const [showExtraOptions, setShowExtraOptions] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RecurringRule | null>(null);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFrequency>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatEndType, setRepeatEndType] = useState<RepeatEndType>('never');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [repeatEndCount, setRepeatEndCount] = useState(10);

  const endTime = useMemo(() => {
    const totalMinutes = startHour * 60 + startMinute + durationMinutes;
    let endHour = Math.floor(totalMinutes / 60);
    let endMinute = totalMinutes % 60;
    
    if (endHour > 23) {
      endHour = 23;
      endMinute = 59;
    }
    
    return { hour: endHour, minute: endMinute };
  }, [startHour, startMinute, durationMinutes]);

  const actualDurationMinutes = useMemo(() => {
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endTime.hour * 60 + endTime.minute;
    return Math.max(1, endTotal - startTotal);
  }, [startHour, startMinute, endTime]);

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (hour: number, minute: number) => {
    setStartHour(hour);
    setStartMinute(minute);
  };

  const handleEndTimeChange = (hour: number, minute: number) => {
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = hour * 60 + minute;
    const newDuration = endTotalMinutes - startTotalMinutes;
    
    if (newDuration > 0) {
      setDurationMinutes(newDuration);
    }
  };

  const handleDurationSelect = (minutes: number) => {
    setDurationMinutes(minutes);
  };

  const toggleTag = (tag: TagType) => {
    setSelectedTags(prev => 
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const findConflicts = useCallback((date: Date, hour: number, minute: number, duration: number): Task[] => {
    const taskStart = setMinutes(setHours(startOfDay(date), hour), minute);
    const taskEnd = new Date(taskStart.getTime() + duration * 60 * 1000);

    return tasks.filter(task => {
      const existingStart = new Date(task.startTime);
      const existingEnd = new Date(task.endTime);
      return taskStart < existingEnd && taskEnd > existingStart;
    });
  }, [tasks]);

  const checkConflicts = useCallback(() => {
    if (mode !== 'calendar') {
      setConflicts([]);
      return;
    }
    const taskDate = new Date(selectedDate);
    const foundConflicts = findConflicts(taskDate, startHour, startMinute, durationMinutes);
    setConflicts(foundConflicts);
  }, [mode, selectedDate, startHour, startMinute, durationMinutes, findConflicts]);

  useEffect(() => {
    checkConflicts();
  }, [checkConflicts]);

  const handleVoiceTaskCreate = (voiceTitle: string, parsed: ParsedDateTime) => {
    if (parsed.date) {
      setSelectedDate(format(parsed.date, 'yyyy-MM-dd'));
    }
    if (parsed.hour !== undefined) {
      setStartHour(parsed.hour);
      setStartMinute(parsed.minute || 0);
    }
    setTitle(voiceTitle);
    setShowVoiceInput(false);
    
    if (settings.conflictAlerts && parsed.date && parsed.hour !== undefined) {
      const taskDate = new Date(parsed.date);
      const voiceConflicts = findConflicts(taskDate, parsed.hour, parsed.minute || 0, durationMinutes);
      if (voiceConflicts.length > 0) {
        addNotification({
          type: 'conflict',
          title: 'חפיפה במשימות',
          message: `המשימה "${voiceTitle}" חופפת עם ${voiceConflicts.length} משימות קיימות`,
          taskId: voiceConflicts[0].id,
        });
      }
    }
    
    toast({
      title: 'זוהה בהצלחה',
      description: 'פרטי המשימה הועברו לטופס',
    });
  };

  const handleMekolelApply = (parsed: ParsedDateTime) => {
    if (parsed.date) {
      setSelectedDate(format(parsed.date, 'yyyy-MM-dd'));
    }
    if (parsed.hour !== undefined) {
      setStartHour(parsed.hour);
      setStartMinute(parsed.minute || 0);
    }
    setTitle(parsed.cleanTitle);
    
    toast({
      title: 'המכולל זיהה בהצלחה',
      description: 'התאריך והשעה הועברו לשדות המתאימים',
    });
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: 'לא נתמך',
        description: 'הדפדפן שלך לא תומך בזיהוי קולי',
        variant: 'destructive',
      });
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לזהות דיבור',
        variant: 'destructive',
      });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTitle(transcript);
      toast({
        title: 'זוהה בהצלחה',
        description: `"${transcript}"`,
      });
    };

    recognition.start();
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין כותרת למשימה',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'calendar') {
      const taskDate = new Date(selectedDate);
      const taskStartTime = isAllDay
        ? startOfDay(taskDate)
        : setMinutes(setHours(startOfDay(taskDate), startHour), startMinute);
      const taskEndTime = isAllDay
        ? endOfDay(taskDate)
        : setMinutes(setHours(startOfDay(taskDate), endTime.hour), endTime.minute);
      const taskDuration = isAllDay ? 24 * 60 : actualDurationMinutes;

      if (!isAllDay && conflicts.length > 0 && settings.conflictAlerts) {
        addNotification({
          type: 'conflict',
          title: 'נוספה משימה עם חפיפה',
          message: `המשימה "${title.trim()}" חופפת עם ${conflicts.length} משימות קיימות`,
        });
      }

      addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: taskStartTime,
        endTime: taskEndTime,
        duration: taskDuration,
        status: 'pending',
        tags: selectedTags,
        repeat: repeatRule || undefined,
        isAllDay: isAllDay || undefined,
      });

      toast({
        title: 'נוסף ליומן',
        description: `המשימה "${title}" נוספה ללוח הזמנים`,
      });

      navigate('/day');
    } else {
      addTemplate({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        duration: durationMinutes,
        categoryId: selectedCategoryId,
        tags: selectedTags,
      });

      toast({
        title: 'נוסף לארון',
        description: `המשימה "${title}" נשמרה בארון המשימות`,
      });

      navigate('/standby');
    }
  };

  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            
            <h1 className="text-lg font-bold">משימה חדשה</h1>
            
            <button 
              onClick={() => setShowVoiceInput(!showVoiceInput)}
              className={cn(
                'p-3 rounded-full transition-all shadow-md',
                showVoiceInput 
                  ? 'bg-orange-500 text-white animate-pulse shadow-orange-500/50' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              )}
              data-testid="button-voice-input"
            >
              {showVoiceInput ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex border-t border-border">
            <button
              onClick={() => setMode('calendar')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 transition-colors',
                mode === 'calendar' 
                  ? 'bg-primary/10 text-primary border-b-2 border-primary' 
                  : 'text-muted-foreground'
              )}
              data-testid="tab-calendar"
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">ליומן</span>
            </button>
            <button
              onClick={() => setMode('cabinet')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 transition-colors',
                mode === 'cabinet' 
                  ? 'bg-primary/10 text-primary border-b-2 border-primary' 
                  : 'text-muted-foreground'
              )}
              data-testid="tab-cabinet"
            >
              <Archive className="w-4 h-4" />
              <span className="text-sm font-medium">לארון</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6 pb-24">
          <AnimatePresence>
            {showVoiceInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4 mb-4 border-primary/50">
                  <div className="text-sm font-medium text-muted-foreground mb-3 text-center">
                    קלט קולי - דבר את פרטי המשימה
                  </div>
                  <VoiceInput
                    existingTasks={tasks}
                    onTaskCreate={handleVoiceTaskCreate}
                    onConflictDetected={(detected) => setConflicts(detected)}
                  />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-muted-foreground">כותרת *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה המשימה? (ניתן לכלול תאריך ושעה)"
              className="text-lg h-12"
              autoFocus
              data-testid="input-title"
            />
            
            <HaMekolel
              title={title}
              existingTasks={tasks}
              onApply={handleMekolelApply}
            />
          </motion.div>

          {conflicts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="p-3 border-destructive/50 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                  <AlertCircle className="w-4 h-4" />
                  חפיפה עם משימות קיימות ({conflicts.length})
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {conflicts.slice(0, 3).map(task => (
                    <li key={task.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {task.title}
                    </li>
                  ))}
                  {conflicts.length > 3 && (
                    <li className="text-xs">ועוד {conflicts.length - 3} משימות...</li>
                  )}
                </ul>
              </Card>
            </motion.div>
          )}

          {mode === 'calendar' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">תאריך ושעה</span>
              </div>
              
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-date"
              />

              <button
                onClick={() => setIsAllDay(!isAllDay)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  isAllDay
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/40'
                )}
                data-testid="button-toggle-allday"
              >
                <Sun className="w-4 h-4" />
                <span>כל היום</span>
                {isAllDay && <span className="text-xs opacity-70">✓</span>}
              </button>

              {!isAllDay && (
              <div className="space-y-4 bg-muted/30 rounded-lg p-4" dir="rtl">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">התחלה:</div>
                    <Button
                      variant="outline"
                      className="w-full text-2xl font-bold h-14"
                      onClick={() => setShowStartPicker(true)}
                      data-testid="button-start-time"
                    >
                      {formatTime(startHour, startMinute)}
                    </Button>
                  </div>
                  
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">סיום:</div>
                    <Button
                      variant="outline"
                      className="w-full text-2xl font-bold h-14"
                      onClick={() => setShowEndPicker(true)}
                      data-testid="button-end-time"
                    >
                      {formatTime(endTime.hour, endTime.minute)}
                    </Button>
                  </div>
                </div>
                
                <DurationPresets
                  selectedDuration={durationMinutes}
                  onDurationSelect={handleDurationSelect}
                />
              </div>
              )}
            </motion.div>
          )}

          {mode === 'cabinet' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">משך זמן קבוע</span>
              </div>
              
              <DurationPresets
                selectedDuration={durationMinutes}
                onDurationSelect={handleDurationSelect}
              />

              <div className="flex items-center gap-2 text-muted-foreground mt-4">
                <Archive className="w-4 h-4" />
                <span className="text-sm font-medium">קטגוריה</span>
              </div>
              
              <Select value={selectedCategoryId || 'none'} onValueChange={(v) => setSelectedCategoryId(v === 'none' ? undefined : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קטגוריה</SelectItem>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          <button
            onClick={() => setShowExtraOptions(!showExtraOptions)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            data-testid="button-toggle-extra-options"
          >
            {showExtraOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="font-medium">אפשרויות נוספות</span>
            {(location || description || selectedTags.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
          </button>

          <AnimatePresence>
            {showExtraOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">מיקום</span>
                  </div>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="היכן?"
                    data-testid="input-location"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">תיאור</span>
                  </div>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="פרטים נוספים..."
                    rows={3}
                    data-testid="input-description"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm font-medium">תגיות</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_TAGS.map((tag) => {
                      const isSelected = selectedTags.some(t => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all',
                            isSelected 
                              ? 'ring-2 ring-offset-2 ring-primary' 
                              : 'opacity-60 hover:opacity-100'
                          )}
                          style={{ 
                            backgroundColor: `${tag.color}${isSelected ? '30' : '15'}`,
                            color: tag.color,
                          }}
                          data-testid={`button-tag-${tag.id}`}
                        >
                          {tag.name}
                          {isSelected && <X className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {mode === 'calendar' && (
            <div className="space-y-3">
              {repeatRule && !showRepeatPanel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                  <Repeat className="w-4 h-4" />
                  <span>חוזר: {formatRecurringSummary(repeatRule)}</span>
                  <button
                    onClick={() => { setRepeatRule(null); }}
                    className="mr-auto p-0.5 rounded hover:bg-primary/20"
                    data-testid="button-remove-repeat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowRepeatPanel(!showRepeatPanel)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                data-testid="button-toggle-repeat"
              >
                <Repeat className="w-4 h-4" />
                <span className="font-medium">↺ חזרה</span>
                {repeatRule && <span className="w-2 h-2 rounded-full bg-primary" />}
              </button>

              <AnimatePresence>
                {showRepeatPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="p-4 space-y-4 border-primary/30">
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">תדירות</span>
                        <div className="grid grid-cols-4 gap-2">
                          {([
                            { value: 'daily' as RepeatFrequency, label: 'כל יום' },
                            { value: 'weekly' as RepeatFrequency, label: 'כל שבוע' },
                            { value: 'monthly' as RepeatFrequency, label: 'כל חודש' },
                            { value: 'yearly' as RepeatFrequency, label: 'כל שנה' },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setRepeatFreq(opt.value)}
                              className={cn(
                                'py-2 px-1 rounded-lg text-xs font-medium transition-all border',
                                repeatFreq === opt.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-secondary/50 text-foreground border-border hover:border-primary/50'
                              )}
                              data-testid={`button-freq-${opt.value}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {repeatFreq === 'weekly' && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">ימים בשבוע</span>
                          <div className="flex gap-1.5 justify-center" dir="rtl">
                            {[
                              { day: 0, label: 'א' },
                              { day: 1, label: 'ב' },
                              { day: 2, label: 'ג' },
                              { day: 3, label: 'ד' },
                              { day: 4, label: 'ה' },
                              { day: 5, label: 'ו' },
                              { day: 6, label: 'ש' },
                            ].map(d => (
                              <button
                                key={d.day}
                                onClick={() => setRepeatDays(prev =>
                                  prev.includes(d.day) ? prev.filter(x => x !== d.day) : [...prev, d.day]
                                )}
                                className={cn(
                                  'w-9 h-9 rounded-full text-sm font-bold transition-all',
                                  repeatDays.includes(d.day)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary/50 text-foreground hover:bg-secondary'
                                )}
                                data-testid={`button-day-${d.day}`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground">סיום</span>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'never' as RepeatEndType, label: 'ללא סוף' },
                            { value: 'date' as RepeatEndType, label: 'עד תאריך' },
                            { value: 'count' as RepeatEndType, label: 'מספר פעמים' },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setRepeatEndType(opt.value)}
                              className={cn(
                                'py-2 px-1 rounded-lg text-xs font-medium transition-all border',
                                repeatEndType === opt.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-secondary/50 text-foreground border-border hover:border-primary/50'
                              )}
                              data-testid={`button-end-${opt.value}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {repeatEndType === 'date' && (
                          <Input
                            type="date"
                            value={repeatEndDate}
                            onChange={(e) => setRepeatEndDate(e.target.value)}
                            className="mt-2"
                            data-testid="input-repeat-end-date"
                          />
                        )}

                        {repeatEndType === 'count' && (
                          <div className="flex items-center gap-3 mt-2">
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={repeatEndCount}
                              onChange={(e) => setRepeatEndCount(Number(e.target.value))}
                              className="w-24"
                              data-testid="input-repeat-end-count"
                            />
                            <span className="text-sm text-muted-foreground">מופעים</span>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => {
                          const rule: RecurringRule = {
                            frequency: repeatFreq,
                            interval: 1,
                            endType: repeatEndType,
                            ...(repeatFreq === 'weekly' && repeatDays.length > 0 ? { daysOfWeek: repeatDays } : {}),
                            ...(repeatEndType === 'date' && repeatEndDate ? { endDate: repeatEndDate } : {}),
                            ...(repeatEndType === 'count' ? { endCount: repeatEndCount } : {}),
                          };
                          setRepeatRule(rule);
                          setShowRepeatPanel(false);
                        }}
                        className="w-full"
                        data-testid="button-confirm-repeat"
                      >
                        אשר חזרה
                      </Button>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            size="lg" 
            onClick={handleSubmit}
            className="w-full max-w-lg mx-auto block"
            data-testid="button-submit-task"
          >
            {mode === 'calendar' ? 'הוסף ליומן' : 'שמור בארון'}
          </Button>
        </div>
      </div>

      <TimeWheelPicker
        open={showStartPicker}
        onOpenChange={setShowStartPicker}
        hour={startHour}
        minute={startMinute}
        onTimeChange={handleStartTimeChange}
        title="שעת התחלה"
      />
      
      <TimeWheelPicker
        open={showEndPicker}
        onOpenChange={setShowEndPicker}
        hour={endTime.hour}
        minute={endTime.minute}
        onTimeChange={handleEndTimeChange}
        title="שעת סיום"
      />
    </AppLayout>
  );
};

export default AddTaskPage;
