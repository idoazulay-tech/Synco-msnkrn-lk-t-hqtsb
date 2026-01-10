import { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { InsightsDrawer } from './InsightsDrawer';
import { useTaskStore } from '@/store/taskStore';
import { parseHebrewDateTime } from '@/lib/hebrewDateParser';
import { addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';

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

interface UnderstandingScreenProps {
  result: InterpretResult;
  originalText: string;
  onReset: () => void;
  onClose: () => void;
}

const intentLabels: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  CREATE_TASK: { label: 'יצירת משימה', icon: FileText, color: 'text-green-500' },
  FREE_TEXT: { label: 'מחשבה חופשית', icon: Brain, color: 'text-blue-500' },
  SCHEDULE_TASK: { label: 'תזמון', icon: Calendar, color: 'text-purple-500' },
  COMPLETE_TASK: { label: 'סיום משימה', icon: CheckCircle, color: 'text-green-600' },
  DEFER_TASK: { label: 'דחייה', icon: Clock, color: 'text-orange-500' },
  UNKNOWN: { label: 'לא ברור', icon: HelpCircle, color: 'text-muted-foreground' },
};

const urgencyColors: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
};

const urgencyLabels: Record<string, string> = {
  CRITICAL: 'קריטי',
  HIGH: 'גבוהה',
  MEDIUM: 'בינונית',
  LOW: 'נמוכה',
};

export function UnderstandingScreen({ result, originalText, onReset, onClose }: UnderstandingScreenProps) {
  const [showInsights, setShowInsights] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [createdTaskTime, setCreatedTaskTime] = useState<string | null>(null);
  const addTask = useTaskStore((state) => state.addTask);
  
  const intentInfo = intentLabels[result.intent] || intentLabels.UNKNOWN;
  const IntentIcon = intentInfo.icon;
  
  const wasTaskCreated = result.action?.type === 'TASK_CREATED' || taskCreated;
  const canCreateTask = (result.intent === 'CREATE_TASK' || result.intent === 'SCHEDULE_TASK') && !wasTaskCreated;

  const handleConfirmTask = () => {
    const title = result.extracted.title || originalText;
    const parsed = parseHebrewDateTime(originalText);
    
    const now = new Date();
    
    let startTime: Date;
    let taskStatus: 'pending' | 'in_progress' = 'pending';
    
    if (parsed.date || parsed.hour !== undefined) {
      let taskDate = parsed.date || startOfDay(now);
      if (parsed.hour !== undefined) {
        startTime = setMinutes(setHours(taskDate, parsed.hour), parsed.minute || 0);
      } else {
        startTime = setMinutes(setHours(taskDate, now.getHours() + 1), 0);
      }
      if (startTime <= now) {
        taskStatus = 'in_progress';
      }
    } else {
      startTime = now;
      taskStatus = 'in_progress';
    }
    
    const endTime = addMinutes(startTime, 30);
    
    addTask({
      title,
      startTime,
      endTime,
      duration: 30,
      status: taskStatus,
      tags: [],
    });
    
    setTaskCreated(true);
    setCreatedTaskTime(startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    
    // Auto-close panel after 1.5 seconds to show task on home screen
    setTimeout(() => {
      onClose();
    }, 1500);
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
            <div className={cn("p-2 rounded-full bg-muted", intentInfo.color)}>
              <IntentIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{intentInfo.label}</h3>
              <p className="text-muted-foreground text-sm">{result.insights.summary}</p>
            </div>
          </div>

          {result.extracted.title && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">כותרת:</p>
              <p className="font-medium">{result.extracted.title}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {result.extracted.urgency && (
              <Badge 
                variant="secondary"
                className={cn("gap-1", urgencyColors[result.extracted.urgency], "text-white")}
              >
                דחיפות: {urgencyLabels[result.extracted.urgency]}
              </Badge>
            )}
            
            {result.extracted.dueAt && (
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(result.extracted.dueAt).toLocaleDateString('he-IL')}
              </Badge>
            )}
          </div>

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

          {canCreateTask && (
            <Button
              onClick={handleConfirmTask}
              className="w-full bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-task"
            >
              <Plus className="h-4 w-4 ml-2" />
              אישור והוספה ללוח זמנים
            </Button>
          )}

          {result.needsApproval && !wasTaskCreated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20"
            >
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span className="text-orange-700 dark:text-orange-400 font-medium">
                נדרש אישור להמשך
              </span>
            </motion.div>
          )}

          {result.questions && result.questions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">שאלות הבהרה:</p>
              {result.questions.map((question, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{question}</span>
                </div>
              ))}
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
        insights={result.insights} 
        onClose={() => setShowInsights(false)}
      />
    </div>
  );
}
