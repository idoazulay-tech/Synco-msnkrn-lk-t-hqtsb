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

interface PendingEntity {
  id: string;
  type: 'task' | 'event';
  title: string;
  schedulingStatus: 'pending' | 'scheduled';
  date?: string;
  time?: string;
  duration?: number;
  missingInfo: string[];
}

interface OrgQuestion {
  id: string;
  textHebrew: string;
  options?: string[];
  expectedAnswerType: string;
}

interface OrgInquiry {
  id: string;
  question: OrgQuestion;
  entity: {
    type: string;
    id: string;
    title: string;
  };
  meta: {
    missingInfo: string[];
  };
}

interface InterpretResult {
  mode: 'task_or_event' | 'journal_entry';
  task: TaskOutput | null;
  journal: JournalOutput | null;
  suggested_tasks_from_journal: SuggestedTask[];
  learning_log: Record<string, string[]>;
  pendingEntity?: PendingEntity;
  inquiry?: OrgInquiry;
  action?: {
    type: string;
    taskFile?: { id: string; title: string };
    taskRun?: { id: string };
    redirectToOrg?: boolean;
    message?: string;
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
  
  const [pendingEntity, setPendingEntity] = useState<PendingEntity | null>(null);
  const [currentInquiry, setCurrentInquiry] = useState<OrgInquiry | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clarifyInputRef = useRef<HTMLInputElement>(null);

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
      
      if (data.pendingEntity && data.inquiry) {
        setPendingEntity(data.pendingEntity);
        setCurrentInquiry(data.inquiry);
        setText('');
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error('Error processing input:', err);
      setError('שגיאה בעיבוד הקלט');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarifyAnswer = async (answer: string) => {
    if (!answer.trim() || !currentInquiry || isAnswering) return;
    
    setIsAnswering(true);
    setClarifyAnswer('');
    
    try {
      const response = await fetch('/api/org/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: currentInquiry.id,
          answer: answer.trim(),
        }),
      });
      
      const result = await response.json();
      
      if (result.resolved && result.entity) {
        const now = new Date();
        let startTime = now;
        let endTime = new Date(now.getTime() + 30 * 60 * 1000);
        
        if (result.entity.date) {
          const timeStr = result.entity.time || '12:00';
          startTime = new Date(`${result.entity.date}T${timeStr}`);
          const duration = result.entity.duration || 30;
          endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        }
        
        addTask({
          title: result.entity.title,
          startTime,
          endTime,
          duration: result.entity.duration || 30,
          status: startTime > now ? 'pending' : 'in_progress',
          tags: [],
        });
        
        setPendingEntity(null);
        setCurrentInquiry(null);
        onClose();
      } else if (result.stillPending && result.updatedInquiry) {
        setCurrentInquiry(result.updatedInquiry);
      }
    } catch (err) {
      console.error('Error answering clarifying question:', err);
      setError('שגיאה בשליחת התשובה');
    } finally {
      setIsAnswering(false);
    }
  };

  const startClarifyVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('הדפדפן לא תומך בזיהוי קול');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setClarifyAnswer(finalTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const handleReset = () => {
    setText('');
    setOriginalText('');
    setResult(null);
    setError(null);
    setPendingEntity(null);
    setCurrentInquiry(null);
    setClarifyAnswer('');
  };

  if (pendingEntity && currentInquiry) {
    const missingDate = currentInquiry.meta.missingInfo.includes('date');
    const missingTime = currentInquiry.meta.missingInfo.includes('start_time') || currentInquiry.meta.missingInfo.includes('time');
    
    return (
      <div className="p-4 space-y-4" dir="rtl">
        <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-3">
            <CalendarPlus className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-800 dark:text-purple-200">
              {pendingEntity.title}
            </span>
          </div>
          
          <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
            {currentInquiry.question.textHebrew}
          </p>
          
          {missingDate && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClarifyAnswer('היום')}
                disabled={isAnswering}
                className="bg-white dark:bg-gray-800"
                data-testid="button-clarify-today"
              >
                היום
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClarifyAnswer('מחר')}
                disabled={isAnswering}
                className="bg-white dark:bg-gray-800"
                data-testid="button-clarify-tomorrow"
              >
                מחר
              </Button>
            </div>
          )}
          
          {missingTime && !missingDate && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClarifyAnswer('בבוקר')}
                disabled={isAnswering}
                className="bg-white dark:bg-gray-800"
                data-testid="button-clarify-morning"
              >
                בבוקר
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClarifyAnswer('בצהריים')}
                disabled={isAnswering}
                className="bg-white dark:bg-gray-800"
                data-testid="button-clarify-noon"
              >
                בצהריים
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClarifyAnswer('בערב')}
                disabled={isAnswering}
                className="bg-white dark:bg-gray-800"
                data-testid="button-clarify-evening"
              >
                בערב
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              ref={clarifyInputRef}
              type="text"
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              placeholder="או הקלד תשובה..."
              className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && clarifyAnswer.trim()) {
                  handleClarifyAnswer(clarifyAnswer);
                }
              }}
              disabled={isAnswering}
              data-testid="input-clarify-answer"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={startClarifyVoice}
              disabled={isAnswering || isListening}
              className={cn(isListening && "bg-orange-100 border-orange-500")}
              data-testid="button-clarify-voice"
            >
              <Mic className={cn("h-4 w-4", isListening && "text-orange-500")} />
            </Button>
            <Button
              size="icon"
              onClick={() => handleClarifyAnswer(clarifyAnswer)}
              disabled={!clarifyAnswer.trim() || isAnswering}
              data-testid="button-clarify-send"
            >
              {isAnswering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            data-testid="button-clarify-cancel"
          >
            ביטול
          </Button>
        </div>
      </div>
    );
  }

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
