import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DurationPresetsProps {
  selectedDuration: number | null;
  onDurationSelect: (minutes: number) => void;
}

const SHORT_DURATIONS = [
  { label: '5 דק׳', minutes: 5 },
  { label: '10 דק׳', minutes: 10 },
  { label: '20 דק׳', minutes: 20 },
  { label: '30 דק׳', minutes: 30 },
  { label: '45 דק׳', minutes: 45 },
];

const LONG_DURATIONS = [
  { label: 'שעה', minutes: 60 },
  { label: '1.5 שעות', minutes: 90 },
  { label: '2 שעות', minutes: 120 },
  { label: '2.5 שעות', minutes: 150 },
  { label: '3 שעות', minutes: 180 },
];

export function DurationPresets({ selectedDuration, onDurationSelect }: DurationPresetsProps) {
  return (
    <div className="space-y-3" dir="rtl">
      <div className="text-sm text-muted-foreground text-right">משך המשימה:</div>
      
      {/* Short durations row */}
      <div className="flex flex-wrap gap-2 justify-end">
        {SHORT_DURATIONS.map((d) => (
          <Button
            key={d.minutes}
            variant={selectedDuration === d.minutes ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDurationSelect(d.minutes)}
            data-testid={`button-duration-${d.minutes}`}
            className="min-w-[60px]"
          >
            {d.label}
          </Button>
        ))}
      </div>
      
      {/* Long durations row */}
      <div className="flex flex-wrap gap-2 justify-end">
        {LONG_DURATIONS.map((d) => (
          <Button
            key={d.minutes}
            variant={selectedDuration === d.minutes ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDurationSelect(d.minutes)}
            data-testid={`button-duration-${d.minutes}`}
            className="min-w-[70px]"
          >
            {d.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
