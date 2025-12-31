import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, MicOff, MapPin, Clock, Tag, FileText, X } from 'lucide-react';
import { format, addHours, setHours, setMinutes, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimelinePicker } from '@/components/ui/timeline-picker';
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
  const [startHour, setStartHour] = useState(() => {
    const hour = new Date().getHours() + 1;
    return hour > 23 ? 8 : hour;
  });
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(() => {
    const hour = new Date().getHours() + 2;
    return hour > 23 ? 9 : hour;
  });
  const [endMinute, setEndMinute] = useState(0);
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [isListening, setIsListening] = useState(false);

  const handleStartTimeChange = (hour: number, minute: number) => {
    setStartHour(hour);
    setStartMinute(minute);
  };

  const handleEndTimeChange = (hour: number, minute: number) => {
    setEndHour(hour);
    setEndMinute(minute);
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
          // Ensure end hour is always after start hour (max 23)
          setEndHour(Math.min(hour + 1, 23));
          setEndMinute(hour === 23 ? 59 : 0);
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
    const taskEndTime = setMinutes(setHours(startOfDay(taskDate), endHour), endMinute);

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startTime: taskStartTime,
      endTime: taskEndTime,
      duration: (taskEndTime.getTime() - taskStartTime.getTime()) / (1000 * 60),
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
            
            <TimelinePicker
              startHour={startHour}
              startMinute={startMinute}
              endHour={endHour}
              endMinute={endMinute}
              onStartChange={handleStartTimeChange}
              onEndChange={handleEndTimeChange}
            />
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
          >
            הוסף משימה
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AddTaskPage;
