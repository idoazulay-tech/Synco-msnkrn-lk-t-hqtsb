import { ArrowLeft } from 'lucide-react';
import { getReflectionCopy, type ResultType } from '@/lib/now/nowReflectionCopy';

interface NowResultReflectionProps {
  resultType: ResultType;
  taskTitle: string;
  onNext: () => void;
  onClose?: () => void;
}

export function NowResultReflection({
  resultType,
  taskTitle,
  onNext,
  onClose,
}: NowResultReflectionProps) {
  const copy = getReflectionCopy(resultType);

  return (
    <div className="w-full max-w-sm flex flex-col gap-4" dir="rtl">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-3 text-right">
        <p className="text-base font-semibold leading-snug">{copy.title}</p>
        <p className="text-xs text-muted-foreground/60 line-clamp-2">{taskTitle}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{copy.message}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onNext}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          {copy.primaryButton}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            {copy.secondaryButton}
          </button>
        )}
      </div>
    </div>
  );
}
