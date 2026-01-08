import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseHebrewDateTime, hasDateTimeInfo, ParsedDateTime, TimeOption } from '@/lib/hebrewDateParser';
import { Task } from '@/types/task';

interface HaMekolelProps {
  title: string;
  existingTasks: Task[];
  onApply: (parsed: ParsedDateTime) => void;
}

export const HaMekolel = ({ title, existingTasks, onApply }: HaMekolelProps) => {
  const [selectedTimeIndex, setSelectedTimeIndex] = useState<number>(0);
  
  const parsed = useMemo(() => {
    if (title.length < 3) return null;
    const result = parseHebrewDateTime(title, existingTasks);
    return hasDateTimeInfo(result) ? result : null;
  }, [title, existingTasks]);

  const formatTime = (hour: number, minute: number = 0) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleApply = () => {
    if (!parsed) return;
    
    if (parsed.isAmbiguousTime && parsed.timeOptions) {
      const selectedOption = parsed.timeOptions[selectedTimeIndex];
      onApply({
        ...parsed,
        hour: selectedOption.hour,
        minute: selectedOption.minute,
      });
    } else {
      onApply(parsed);
    }
  };

  const handleTimeOptionSelect = (index: number) => {
    setSelectedTimeIndex(index);
  };

  if (!parsed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2 space-y-2"
      >
        {parsed.isAmbiguousTime && parsed.timeOptions && (
          <div className="p-2 bg-muted/50 rounded-md">
            <div className="text-xs text-muted-foreground mb-2 text-center">
              בחר את השעה המתאימה:
            </div>
            <div className="flex gap-2 justify-center">
              {parsed.timeOptions.map((option, index) => (
                <Button
                  key={index}
                  type="button"
                  variant={selectedTimeIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTimeOptionSelect(index)}
                  className="gap-1"
                  data-testid={`button-time-option-${index}`}
                >
                  <Clock className="w-3 h-3" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApply}
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
            {parsed.hour !== undefined && !parsed.isAmbiguousTime && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {formatTime(parsed.hour, parsed.minute)}
              </Badge>
            )}
            {parsed.isAmbiguousTime && parsed.timeOptions && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {parsed.timeOptions[selectedTimeIndex].label}
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
