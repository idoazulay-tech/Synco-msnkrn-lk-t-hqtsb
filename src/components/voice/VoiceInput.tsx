import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, Volume2, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseHebrewDateTime, hasDateTimeInfo, ParsedDateTime, TimeOption } from '@/lib/hebrewDateParser';
import { Task } from '@/types/task';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface VoiceInputProps {
  existingTasks: Task[];
  onTaskCreate: (title: string, parsed: ParsedDateTime) => void;
  onConflictDetected?: (conflicts: Task[]) => void;
}

type RecognitionState = 'idle' | 'listening' | 'processing' | 'result' | 'error';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export const VoiceInput = ({ existingTasks, onTaskCreate, onConflictDetected }: VoiceInputProps) => {
  const [state, setState] = useState<RecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedDateTime | null>(null);
  const [conflicts, setConflicts] = useState<Task[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
      setErrorMessage('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      if (state === 'listening') {
        setState('processing');
        processTranscript();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState('error');
      switch (event.error) {
        case 'no-speech':
          setErrorMessage('לא נשמע דיבור. נסה שוב.');
          break;
        case 'not-allowed':
          setErrorMessage('גישה למיקרופון נדחתה. אנא אשר גישה למיקרופון.');
          break;
        case 'network':
          setErrorMessage('שגיאת רשת. בדוק את החיבור לאינטרנט.');
          break;
        default:
          setErrorMessage('שגיאה בזיהוי קולי. נסה שוב.');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const processTranscript = useCallback(() => {
    if (!transcript.trim()) {
      setState('error');
      setErrorMessage('לא זוהה טקסט. נסה שוב.');
      return;
    }

    const result = parseHebrewDateTime(transcript, existingTasks);
    setParsed(result);

    if (hasDateTimeInfo(result) && result.date && result.hour !== undefined) {
      const taskConflicts = findConflicts(result, existingTasks);
      setConflicts(taskConflicts);
      if (taskConflicts.length > 0 && onConflictDetected) {
        onConflictDetected(taskConflicts);
      }
    }

    setState('result');
  }, [transcript, existingTasks, onConflictDetected]);

  const findConflicts = (parsed: ParsedDateTime, tasks: Task[]): Task[] => {
    if (!parsed.date || parsed.hour === undefined) return [];

    const hour = parsed.isAmbiguousTime && parsed.timeOptions 
      ? parsed.timeOptions[selectedTimeIndex].hour 
      : parsed.hour;
    const minute = parsed.minute || 0;

    const taskStart = new Date(parsed.date);
    taskStart.setHours(hour, minute, 0, 0);
    const taskEnd = new Date(taskStart.getTime() + 60 * 60 * 1000);

    return tasks.filter(task => {
      const existingStart = new Date(task.startTime);
      const existingEnd = new Date(task.endTime);
      return (taskStart < existingEnd && taskEnd > existingStart);
    });
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setConflicts([]);
      setParsed(null);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleConfirm = () => {
    if (parsed) {
      const finalParsed = parsed.isAmbiguousTime && parsed.timeOptions
        ? { ...parsed, hour: parsed.timeOptions[selectedTimeIndex].hour, minute: parsed.timeOptions[selectedTimeIndex].minute }
        : parsed;
      onTaskCreate(parsed.cleanTitle || transcript, finalParsed);
      reset();
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setParsed(null);
    setConflicts([]);
    setErrorMessage('');
    setSelectedTimeIndex(0);
  };

  if (!isSupported) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MicOff className="w-5 h-5" />
          <span>זיהוי קולי לא נתמך בדפדפן זה</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              onClick={startListening}
              size="lg"
              className="w-full gap-2"
              data-testid="button-voice-start"
            >
              <Mic className="w-5 h-5" />
              לחץ לדיבור
            </Button>
          </motion.div>
        )}

        {state === 'listening' && (
          <motion.div
            key="listening"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Card className="p-4 border-primary">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="p-3 bg-primary/10 rounded-full"
                >
                  <Volume2 className="w-6 h-6 text-primary" />
                </motion.div>
                <div className="flex-1">
                  <div className="text-sm font-medium">מקשיב...</div>
                  <div className="text-muted-foreground text-sm" dir="rtl">
                    {transcript || 'דבר עכשיו'}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={stopListening}
                  data-testid="button-voice-stop"
                >
                  <MicOff className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {state === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center p-4"
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="mr-2">מעבד...</span>
          </motion.div>
        )}

        {state === 'result' && parsed && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Card className="p-4">
              <div className="space-y-3">
                <div className="text-sm font-medium">זוהה:</div>
                <div className="text-lg" dir="rtl">{parsed.cleanTitle || transcript}</div>
                
                <div className="flex flex-wrap gap-2">
                  {parsed.date && (
                    <Badge variant="secondary">
                      {format(parsed.date, 'EEEE dd/MM', { locale: he })}
                    </Badge>
                  )}
                  {parsed.hour !== undefined && !parsed.isAmbiguousTime && (
                    <Badge variant="secondary">
                      {`${parsed.hour.toString().padStart(2, '0')}:${(parsed.minute || 0).toString().padStart(2, '0')}`}
                    </Badge>
                  )}
                </div>

                {parsed.isAmbiguousTime && parsed.timeOptions && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">בחר שעה:</div>
                    <div className="flex gap-2">
                      {parsed.timeOptions.map((option, index) => (
                        <Button
                          key={index}
                          variant={selectedTimeIndex === index ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTimeIndex(index)}
                          data-testid={`button-voice-time-${index}`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {conflicts.length > 0 && (
                  <div className="p-2 bg-destructive/10 rounded-md border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                      <AlertCircle className="w-4 h-4" />
                      חפיפה עם משימות קיימות:
                    </div>
                    <ul className="mt-1 text-sm text-muted-foreground">
                      {conflicts.map(task => (
                        <li key={task.id}>• {task.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex gap-2">
              <Button
                onClick={handleConfirm}
                className="flex-1 gap-2"
                data-testid="button-voice-confirm"
              >
                <Check className="w-4 h-4" />
                אישור והוספה
              </Button>
              <Button
                variant="outline"
                onClick={reset}
                data-testid="button-voice-cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Card className="p-4 border-destructive">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span>{errorMessage}</span>
              </div>
            </Card>
            <Button onClick={reset} variant="outline" className="w-full">
              נסה שוב
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
