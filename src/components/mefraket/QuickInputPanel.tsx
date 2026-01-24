import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Mic, Send, Loader2, MicOff, Heart, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { UnderstandingScreen } from './UnderstandingScreen';
import { RegulationModal } from './RegulationModal';
import { useTaskStore } from '@/store/taskStore';
import { startOfDay, endOfDay, addDays } from 'date-fns';

interface QuickInputPanelProps {
  mode: 'text' | 'voice';
  onClose: () => void;
  onModeChange: (mode: 'text' | 'voice') => void;
}

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
}

export function QuickInputPanel({ mode, onClose, onModeChange }: QuickInputPanelProps) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<InterpretResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegulation, setShowRegulation] = useState(false);
  
  const tasks = useTaskStore((state) => state.tasks);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGoToFullForm = () => {
    onClose();
    navigate('/add');
  };

  useEffect(() => {
    if (mode === 'text' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'voice') {
      startListening();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [mode]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('הדפדפן לא תומך בזיהוי קול');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      finalTranscript = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setText(finalTranscript || interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('נדרשת הרשאה למיקרופון');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleSubmit = async () => {
    if (!text.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    setOriginalText(text.trim());
    
    try {
      // Get existing tasks for conflict detection (today and tomorrow)
      const today = new Date();
      const dayStart = startOfDay(today);
      const dayEnd = endOfDay(addDays(today, 1));
      
      const existingTasks = tasks
        .filter(task => {
          const taskStart = new Date(task.startTime);
          return taskStart >= dayStart && taskStart <= dayEnd;
        })
        .map(task => ({
          id: task.id,
          title: task.title,
          startTime: new Date(task.startTime).toISOString(),
          endTime: new Date(task.endTime).toISOString(),
        }));
      
      const response = await fetch('/api/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.trim(),
          existingTasks,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to process input');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Error processing input:', err);
      setError('שגיאה בעיבוד הקלט');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setText('');
    setOriginalText('');
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <UnderstandingScreen
        result={result}
        originalText={originalText}
        onReset={handleReset}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 justify-center">
        <Button
          variant={mode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            stopListening();
            onModeChange('text');
          }}
          className={cn(
            "gap-2",
            mode === 'text' && "bg-blue-500 hover:bg-blue-600"
          )}
          data-testid="button-mode-text"
        >
          <Keyboard className="h-4 w-4" />
          טקסט
        </Button>
        <Button
          variant={mode === 'voice' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange('voice')}
          className={cn(
            "gap-2",
            mode === 'voice' && "bg-orange-500 hover:bg-orange-600"
          )}
          data-testid="button-mode-voice"
        >
          <Mic className="h-4 w-4" />
          קול
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'voice' ? (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <motion.div
              animate={isListening ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center",
                isListening 
                  ? "bg-orange-500 text-white" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isListening ? (
                <Mic className="h-10 w-10" />
              ) : (
                <MicOff className="h-10 w-10" />
              )}
            </motion.div>
            
            <p className="text-muted-foreground text-center">
              {isListening ? 'מקשיב...' : 'לחץ להתחלה'}
            </p>
            
            {text && (
              <div className="w-full p-4 bg-muted rounded-lg text-center">
                <p className="text-lg" dir="rtl">{text}</p>
              </div>
            )}
            
            <div className="flex gap-2">
              {!isListening && !text && (
                <Button
                  onClick={startListening}
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="button-start-listening"
                >
                  <Mic className="h-4 w-4 ml-2" />
                  התחל הקלטה
                </Button>
              )}
              
              {isListening && (
                <Button
                  variant="outline"
                  onClick={stopListening}
                  data-testid="button-stop-listening"
                >
                  סיים הקלטה
                </Button>
              )}
              
              {!isListening && text && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setText('');
                      startListening();
                    }}
                    data-testid="button-retry-voice"
                  >
                    נסה שוב
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isProcessing}
                    className="bg-orange-500 hover:bg-orange-600"
                    data-testid="button-send-voice"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 ml-2" />
                        שלח
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="מה צריך לעשות? כתוב כאן..."
              className="min-h-[120px] text-lg resize-none"
              dir="rtl"
              data-testid="textarea-quick-input"
            />
            
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || isProcessing}
              className="w-full bg-blue-500 hover:bg-blue-600 h-12"
              data-testid="button-submit-input"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5 ml-2" />
                  שלח
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-destructive text-center text-sm"
        >
          {error}
        </motion.p>
      )}

      <div className="pt-4 border-t space-y-2">
        <Button
          variant="outline"
          onClick={handleGoToFullForm}
          className="w-full gap-2"
          data-testid="button-full-form"
        >
          <CalendarPlus className="h-4 w-4" />
          יצירה רגילה עם בחירת תאריך ושעה
        </Button>
        <Button
          variant="ghost"
          onClick={() => setShowRegulation(true)}
          className="w-full gap-2 text-muted-foreground"
          data-testid="button-regulation"
        >
          <Heart className="h-4 w-4" />
          צריך ויסות?
        </Button>
      </div>

      <RegulationModal 
        isOpen={showRegulation} 
        onClose={() => setShowRegulation(false)} 
      />
    </div>
  );
}
