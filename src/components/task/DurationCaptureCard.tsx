import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Delta options shown as quick-pick buttons (added to plannedDurationMinutes)
const DELTA_OPTIONS = [5, 10, 15, 20, 30] as const;

export interface DurationCaptureCardProps {
  taskTitle: string;
  plannedDurationMinutes: number;
  onSelect: (confirmedMinutes: number | null) => void;
  onCancel: () => void;
}

/**
 * Bottom-sheet overlay asking "כמה זמן לקח בפועל?" before a no-timer
 * completion is committed to the store.
 *
 * Wrap the usage site in <AnimatePresence> for enter/exit animation.
 * Voice input ("הקלט") is intentionally absent — deferred to a future task.
 */
export const DurationCaptureCard = ({
  taskTitle,
  plannedDurationMinutes,
  onSelect,
  onCancel,
}: DurationCaptureCardProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCustomSubmit = () => {
    const parsed = parseInt(customValue.trim(), 10);
    if (!customValue.trim() || isNaN(parsed) || parsed <= 0 || !isFinite(parsed)) {
      setCustomError('אנא הכנס מספר דקות חיובי שלם');
      return;
    }
    onSelect(parsed);
  };

  const handleShowCustom = () => {
    setShowCustom(true);
    setCustomError('');
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        data-testid="backdrop-duration-capture"
      />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative z-10 w-full max-w-md bg-background border border-border rounded-t-2xl shadow-2xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="card-duration-capture"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">הושלם ✓</p>
            <h3 className="text-base font-semibold text-foreground leading-snug">{taskTitle}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground"
            data-testid="button-duration-cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm font-medium text-foreground">כמה זמן לקח בפועל?</p>

        <div className="space-y-2">
          <Button
            variant="default"
            className="w-full gap-2 justify-between"
            onClick={() => onSelect(plannedDurationMinutes)}
            data-testid="button-duration-as-planned"
          >
            <span>כמתוכנן</span>
            <span className="text-xs opacity-75">{plannedDurationMinutes} דקות</span>
          </Button>

          <div className="grid grid-cols-5 gap-1.5">
            {DELTA_OPTIONS.map((delta) => (
              <Button
                key={delta}
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => onSelect(plannedDurationMinutes + delta)}
                data-testid={`button-duration-plus-${delta}`}
              >
                +{delta} דק׳
              </Button>
            ))}
          </div>
        </div>

        {showCustom ? (
          <div className="space-y-1.5">
            <div className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                type="number"
                min={1}
                step={1}
                placeholder="כמה דקות לקח בפועל?"
                value={customValue}
                onChange={(e) => { setCustomValue(e.target.value); setCustomError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                className="flex-1 text-right"
                data-testid="input-duration-custom"
              />
              <Button
                size="sm"
                onClick={handleCustomSubmit}
                data-testid="button-duration-custom-submit"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowCustom(false); setCustomError(''); }}
                data-testid="button-duration-custom-cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {customError && (
              <p className="text-xs text-destructive" data-testid="text-duration-custom-error">
                {customError}
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleShowCustom}
            data-testid="button-duration-other"
          >
            <ChevronRight className="w-4 h-4" />
            אחר
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full text-muted-foreground text-sm"
          onClick={() => onSelect(null)}
          data-testid="button-duration-dont-remember"
        >
          לא זוכר
        </Button>
      </motion.div>
    </div>
  );
};
