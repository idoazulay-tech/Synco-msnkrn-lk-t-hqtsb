import { Clock, Zap } from 'lucide-react';

interface NowTask {
  id: string;
  title: string;
  priority: string | null;
  duration: number;
}

interface NowActionCardProps {
  task: NowTask;
  reason: string;
  candidateCount: number;
  staleCount?: number;
  onStart: () => void;
  onSkip: () => void;
}

export function NowActionCard({
  task,
  reason,
  candidateCount,
  staleCount,
  onStart,
  onSkip,
}: NowActionCardProps) {
  return (
    <div className="w-full max-w-sm flex flex-col gap-4" dir="rtl">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-3 text-right">
        <p className="text-lg font-semibold leading-snug">{task.title}</p>

        {task.duration > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock className="w-3.5 h-3.5" />
            <span>{task.duration} דקות</span>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed">{reason}</p>

        {candidateCount > 1 && (
          <p className="text-xs text-muted-foreground/60">
            נבחרה מתוך {candidateCount} משימות פתוחות
            {staleCount && staleCount > 0 ? ` · ${staleCount} משימות ישנות הוסרו` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onStart}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Zap className="w-4 h-4" />
          התחל
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2.5 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
