import { useRef, useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TimeWheelPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hour: number;
  minute: number;
  onTimeChange: (hour: number, minute: number) => void;
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 59];

export function TimeWheelPicker({
  open,
  onOpenChange,
  hour,
  minute,
  onTimeChange,
  title = 'בחר שעה'
}: TimeWheelPickerProps) {
  const [selectedHour, setSelectedHour] = useState(hour);
  const [selectedMinute, setSelectedMinute] = useState(() => {
    // Handle 59 specially, otherwise round to nearest 5
    if (minute === 59) return 59;
    const rounded = Math.round(minute / 5) * 5;
    return rounded >= 60 ? 55 : rounded;
  });

  useEffect(() => {
    if (open) {
      setSelectedHour(hour);
      // Handle 59 specially, otherwise round to nearest 5
      if (minute === 59) {
        setSelectedMinute(59);
      } else {
        const rounded = Math.round(minute / 5) * 5;
        setSelectedMinute(rounded >= 60 ? 55 : rounded);
      }
    }
  }, [open, hour, minute]);

  const incrementHour = useCallback(() => {
    setSelectedHour(h => (h + 1) % 24);
  }, []);

  const decrementHour = useCallback(() => {
    setSelectedHour(h => (h - 1 + 24) % 24);
  }, []);

  const incrementMinute = useCallback(() => {
    setSelectedMinute(m => {
      const idx = MINUTES.indexOf(m);
      return MINUTES[(idx + 1) % MINUTES.length];
    });
  }, []);

  const decrementMinute = useCallback(() => {
    setSelectedMinute(m => {
      const idx = MINUTES.indexOf(m);
      return MINUTES[(idx - 1 + MINUTES.length) % MINUTES.length];
    });
  }, []);

  const handleConfirm = () => {
    onTimeChange(selectedHour, selectedMinute);
    onOpenChange(false);
  };

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[300px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center justify-center gap-4 py-6">
          {/* Minutes Column */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={incrementMinute}
              data-testid="button-increment-minute"
            >
              <ChevronUp className="h-6 w-6" />
            </Button>
            <div 
              className="text-4xl font-bold w-16 text-center bg-muted rounded-md py-2"
              data-testid="display-minute"
            >
              {formatNumber(selectedMinute)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={decrementMinute}
              data-testid="button-decrement-minute"
            >
              <ChevronDown className="h-6 w-6" />
            </Button>
            <span className="text-sm text-muted-foreground">דקות</span>
          </div>

          <div className="text-4xl font-bold">:</div>

          {/* Hours Column */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={incrementHour}
              data-testid="button-increment-hour"
            >
              <ChevronUp className="h-6 w-6" />
            </Button>
            <div 
              className="text-4xl font-bold w-16 text-center bg-muted rounded-md py-2"
              data-testid="display-hour"
            >
              {formatNumber(selectedHour)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={decrementHour}
              data-testid="button-decrement-hour"
            >
              <ChevronDown className="h-6 w-6" />
            </Button>
            <span className="text-sm text-muted-foreground">שעות</span>
          </div>
        </div>

        <Button 
          onClick={handleConfirm} 
          className="w-full"
          data-testid="button-confirm-time"
        >
          אישור
        </Button>
      </DialogContent>
    </Dialog>
  );
}
