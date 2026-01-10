import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Mic, Send, Loader2, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { UnderstandingScreen } from './UnderstandingScreen';

interface QuickInputPanelProps {
  mode: 'text' | 'voice';
  onClose: () => void;
  onModeChange: (mode: 'text' | 'voice') => void;
}

interface InterpretResult {
  intent: string;
  extracted: {
    title?: string;
    dueAt?: string;
    urgency?: string;
  };
  autoAction: boolean;
  needsApproval: boolean;
  questions?: string[];
  insights: {
    summary: string;
    detected: Record<string, unknown>;
  };
  action?: {
    type: string;
    taskFile?: { id: string; title: string };
    taskRun?: { id: string };
  };
}

export function QuickInputPanel({ mode, onClose, onModeChange }: QuickInputPanelProps) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<InterpretResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setText(transcript);
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
      if (text.trim()) {
        handleSubmit();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [text]);

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
    
    try {
      const response = await fetch('/api/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
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
    setResult(null);
    setError(null);
    if (mode === 'voice') {
      startListening();
    }
  };

  if (result) {
    return (
      <UnderstandingScreen
        result={result}
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
            
            {!isListening && (
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
    </div>
  );
}
