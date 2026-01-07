import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseHebrewDateTime, hasDateTimeInfo, ParsedDateTime } from '@/lib/hebrewDateParser';
import { Task } from '@/types/task';

interface HaMekolelProps {
  title: string;
  existingTasks: Task[];
  onApply: (parsed: ParsedDateTime) => void;
}

export const HaMekolel = ({ title, existingTasks, onApply }: HaMekolelProps) => {
  const parsed = useMemo(() => {
    if (title.length < 3) return null;
    const result = parseHebrewDateTime(title, existingTasks);
    return hasDateTimeInfo(result) ? result : null;
  }, [title, existingTasks]);

  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  if (!parsed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onApply(parsed)}
          className="w-full gap-2 border-primary/50 text-primary group"
          data-testid="button-hamekolel"
        >
          <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
          <span className="font-medium">מכולל</span>
          <span className="text-muted-foreground text-xs">- העבר לשדות</span>
          
          <div className="flex items-center gap-1 mr-auto">
            {parsed.date && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Calendar className="w-3 h-3" />
                {format(parsed.date, 'EEEE dd/MM', { locale: he })}
              </Badge>
            )}
            {parsed.hour !== undefined && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {formatTime(parsed.hour, parsed.minute)}
              </Badge>
            )}
          </div>
        </Button>
        
        {parsed.parsedExpressions.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground text-center">
            זוהה: {parsed.parsedExpressions.join(', ')}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
