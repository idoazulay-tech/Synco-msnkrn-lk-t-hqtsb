import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, MicOff, MapPin, Clock, Tag, FileText, X } from 'lucide-react';
import { format, addHours, setHours, setMinutes, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeWheelPicker } from '@/components/ui/time-wheel-picker';
import { DurationPresets } from '@/components/ui/duration-presets';
import { useTaskStore } from '@/store/taskStore';
import { DEFAULT_TAGS, Tag as TagType } from '@/types/task';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const AddTaskPage = () => {
  const navigate = useNavigate();
  const { addTask, tags } = useTaskStore();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Time state
  const [startHour, setStartHour] = useState(() => {
    const hour = new Date().getHours() + 1;
    return hour > 23 ? 8 : hour;
  });
  const [startMinute, setStartMinute] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60); // Default 1 hour
  
  // Wheel picker states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Calculate end time from start + duration
  const endTime = useMemo(() => {
    const totalMinutes = startHour * 60 + startMinute + durationMinutes;
    let endHour = Math.floor(totalMinutes / 60);
    let endMinute = totalMinutes % 60;
    
    // Cap at 23:59 to avoid going to next day
    if (endHour > 23) {
      endHour = 23;
      endMinute = 59;
    }
    
    return { hour: endHour, minute: endMinute };
  }, [startHour, startMinute, durationMinutes]);

  // Calculate actual duration (may differ from durationMinutes if capped)
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
    // Calculate new duration based on new end time
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
      
      // Simple parsing for demo - in production, use NLP
      if (transcript.includes('מחר')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setSelectedDate(format(tomorrow, 'yyyy-MM-dd'));
      }
      
      // Extract time mentions (basic pattern)
      const timeMatch = transcript.match(/ב?(\d{1,2})(:\d{2})?/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        if (hour >= 0 && hour <= 23) {
          setStartHour(hour);
          setStartMinute(0);
          setDurationMinutes(60); // Default 1 hour duration
        }
      }

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
    
    const taskDate = new Date(selectedDate);
    const taskStartTime = setMinutes(setHours(startOfDay(taskDate), startHour), startMinute);
    const taskEndTime = setMinutes(setHours(startOfDay(taskDate), endTime.hour), endTime.minute);

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startTime: taskStartTime,
      endTime: taskEndTime,
      duration: actualDurationMinutes,
      status: 'pending',
      tags: selectedTags,
    });

    toast({
      title: 'נוסף בהצלחה',
      description: `המשימה "${title}" נוספה ללוח הזמנים`,
    });

    navigate('/');
  };

  return (
    <AppLayout hideNav>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
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
              onClick={handleVoiceInput}
              className={cn(
                'p-2 rounded-full transition-colors',
                isListening ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
              )}
              data-testid="button-voice-input"
            >
              {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Form */}
        <div className="flex-1 p-6 space-y-6 pb-24">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-muted-foreground">כותרת *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה המשימה?"
              className="text-lg h-12"
              autoFocus
              data-testid="input-title"
            />
          </motion.div>

          {/* Date & Time */}
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
            
            {/* Time Selection */}
            <div className="space-y-4 bg-muted/30 rounded-lg p-4" dir="rtl">
              {/* Start and End Time Display */}
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
              
              {/* Duration Presets */}
              <DurationPresets
                selectedDuration={durationMinutes}
                onDurationSelect={handleDurationSelect}
              />
            </div>
          </motion.div>

          {/* Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
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
          </motion.div>

          {/* Description */}
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
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרטים נוספים..."
              rows={3}
              data-testid="input-description"
            />
          </motion.div>

          {/* Tags */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
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
                    {tag.icon && <span>{tag.icon}</span>}
                    {tag.name}
                    {isSelected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button 
            size="lg" 
            onClick={handleSubmit}
            className="w-full max-w-lg mx-auto block"
            data-testid="button-submit-task"
          >
            הוסף משימה
          </Button>
        </div>
      </div>

      {/* Time Wheel Pickers */}
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
