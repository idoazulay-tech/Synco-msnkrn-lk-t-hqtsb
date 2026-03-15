import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Clock, MapPin, Tag, FileText, ChevronDown, ChevronUp, Repeat, X, Sun } from 'lucide-react';
import { format, setHours, setMinutes, startOfDay, endOfDay, differenceInMinutes, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { TimeWheelPicker } from '@/components/ui/time-wheel-picker';
import { DurationPresets } from '@/components/ui/duration-presets';
import { useTaskStore } from '@/store/taskStore';
import { useToast } from '@/hooks/use-toast';
import { CompactSchedule, ScheduleToggle } from '@/components/layout/CompactSchedule';
import { DEFAULT_TAGS, Tag as TagType, RecurringRule, RepeatFrequency, RepeatEndType } from '@/types/task';
import { cn } from '@/lib/utils';
import { formatRecurringSummary } from '@/lib/recurringEngine';

const EditTaskPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTaskById, updateTask } = useTaskStore();
  const { toast } = useToast();
  const task = id ? getTaskById(id) : undefined;

  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [showExtraOptions, setShowExtraOptions] = useState(false);

  const [isAllDay, setIsAllDay] = useState(false);
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RecurringRule | null>(null);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFrequency>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatEndType, setRepeatEndType] = useState<RepeatEndType>('never');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [repeatEndCount, setRepeatEndCount] = useState(10);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setLocation(task.location || '');
      setSelectedDate(format(new Date(task.startTime), 'yyyy-MM-dd'));
      setStartHour(new Date(task.startTime).getHours());
      setStartMinute(new Date(task.startTime).getMinutes());
      setDurationMinutes(differenceInMinutes(new Date(task.endTime), new Date(task.startTime)));
      setSelectedTags(task.tags || []);

      if (task.repeat) {
        setRepeatRule(task.repeat);
        setRepeatFreq(task.repeat.frequency);
        setRepeatDays(task.repeat.daysOfWeek || []);
        setRepeatEndType(task.repeat.endType);
        setRepeatEndDate(task.repeat.endDate || '');
        setRepeatEndCount(task.repeat.endCount || 10);
      }

      setIsAllDay(task.isAllDay || false);

      if (task.description || task.location || (task.tags && task.tags.length > 0)) {
        setShowExtraOptions(true);
      }
    }
  }, [task]);

  const endTime = useMemo(() => {
    const totalMinutes = startHour * 60 + startMinute + durationMinutes;
    let endHour = Math.floor(totalMinutes / 60);
    let endMinute = totalMinutes % 60;
    if (endHour > 23) { endHour = 23; endMinute = 59; }
    return { hour: endHour, minute: endMinute };
  }, [startHour, startMinute, durationMinutes]);

  const actualDurationMinutes = useMemo(() => {
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endTime.hour * 60 + endTime.minute;
    return Math.max(1, endTotal - startTotal);
  }, [startHour, startMinute, endTime]);

  const formatTime = (hour: number, minute: number) =>
    `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  const handleStartTimeChange = (hour: number, minute: number) => {
    setStartHour(hour);
    setStartMinute(minute);
  };

  const handleEndTimeChange = (hour: number, minute: number) => {
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = hour * 60 + minute;
    const newDuration = endTotalMinutes - startTotalMinutes;
    if (newDuration > 0) setDurationMinutes(newDuration);
  };

  const handleDurationSelect = (minutes: number) => setDurationMinutes(minutes);

  const toggleTag = (tag: TagType) => {
    setSelectedTags(prev =>
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (!task) return;
    if (!title.trim()) {
      toast({ title: 'שגיאה', description: 'נא להזין כותרת למשימה', variant: 'destructive' });
      return;
    }

    const taskDate = new Date(selectedDate);
    const taskStartTime = isAllDay
      ? startOfDay(taskDate)
      : setMinutes(setHours(startOfDay(taskDate), startHour), startMinute);
    const taskEndTime = isAllDay
      ? endOfDay(taskDate)
      : setMinutes(setHours(startOfDay(taskDate), endTime.hour), endTime.minute);
    const taskDuration = isAllDay ? 24 * 60 : actualDurationMinutes;

    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startTime: taskStartTime,
      endTime: taskEndTime,
      duration: taskDuration,
      tags: selectedTags,
      repeat: repeatRule || undefined,
      isAllDay: isAllDay || undefined,
      status: 'pending',
    });

    toast({
      title: 'המשימה עודכנה',
      description: `"${title.trim()}" עודכנה בהצלחה`,
    });

    navigate(-1);
  };

  if (!task) {
    return (
      <AppLayout hideNav>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">משימה לא נמצאה</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col">
        <ScheduleToggle onClick={() => setShowSchedule(true)} />

        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">עריכת משימה</h1>
            <div className="w-10" />
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-muted-foreground">כותרת *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="שם המשימה"
              className="text-lg h-12"
              data-testid="input-edit-title"
            />
          </motion.div>

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
              data-testid="input-edit-date"
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

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'ring-2 ring-primary' : ''}
                data-testid="button-today"
              >
                היום
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                className={selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'ring-2 ring-primary' : ''}
                data-testid="button-tomorrow"
              >
                מחר
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedDate(format(addDays(new Date(), 2), 'yyyy-MM-dd'))}
                className={selectedDate === format(addDays(new Date(), 2), 'yyyy-MM-dd') ? 'ring-2 ring-primary' : ''}
                data-testid="button-day-after"
              >
                מחרתיים
              </Button>
            </div>

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
              <DurationPresets selectedDuration={durationMinutes} onDurationSelect={handleDurationSelect} />
            </div>
            )}
          </motion.div>

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
                    data-testid="input-edit-location"
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
                    data-testid="input-edit-description"
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
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button
            size="lg"
            onClick={handleSubmit}
            className="w-full max-w-lg mx-auto block"
            data-testid="button-confirm-edit"
          >
            שמור שינויים
          </Button>
        </div>

        <CompactSchedule
          isOpen={showSchedule}
          onClose={() => setShowSchedule(false)}
          currentTaskId={task.id}
        />
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

export default EditTaskPage;
