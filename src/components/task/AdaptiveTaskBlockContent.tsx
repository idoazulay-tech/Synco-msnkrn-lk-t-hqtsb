/**
 * AdaptiveTaskBlockContent.tsx
 *
 * תוכן אדפטיבי לבלוק משימה ב-DayView.
 * מציג תוכן שונה לפי משך המשימה:
 *
 *   full    (>45 דק')  — שם + שעות בשתי שורות + progress%
 *   compact (16-45 דק') — שם + שעות בשורה אחת
 *   tiny    (6-15 דק')  — שעת התחלה + שם מקוצר
 *   micro   (1-5 דק')   — שם בלבד (מקוצר)
 *
 * חוקים:
 *   - overflow: hidden תמיד
 *   - text-overflow: ellipsis תמיד
 *   - white-space: nowrap תמיד
 *   - min-width: 0 תמיד
 *   - direction: rtl, text-align: right
 *   - אסור לשנות גובה הבלוק
 *   - אסור לשנות מיקום הבלוק
 */

import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type TaskBlockMode = 'micro' | 'tiny' | 'compact' | 'full';

export const HOUR_HEIGHT_FOR_MODE = 80;

/** מחשב mode לפי rawHeightPx (position.height לפני clamp). */
export function getTaskBlockMode(rawHeightPx: number): TaskBlockMode {
  const dur = Math.round((rawHeightPx / HOUR_HEIGHT_FOR_MODE) * 60);
  if (dur <= 5)  return 'micro';
  if (dur <= 15) return 'tiny';
  if (dur <= 45) return 'compact';
  return 'full';
}

/** גודל פונט לפי actualHeight (אחרי clamp). */
export function getAdaptiveFontSize(actualHeightPx: number, mode: TaskBlockMode): string {
  if (mode === 'micro') return 'text-[8px]';
  if (mode === 'tiny')  return 'text-[9px]';
  if (actualHeightPx <= 30) return 'text-[10px]';
  if (actualHeightPx <= 46) return 'text-[11px]';
  return 'text-xs';
}

/** ריפוד לפי actualHeight. */
export function getAdaptivePadding(actualHeightPx: number, mode: TaskBlockMode): string {
  if (mode === 'micro' || mode === 'tiny') return 'px-1 py-0';
  if (actualHeightPx <= 30) return 'px-1.5 py-0.5';
  return 'px-2 py-1';
}

interface AdaptiveTaskBlockContentProps {
  mode: TaskBlockMode;
  title: string;
  startStr: string;
  endStr: string;
  actualHeightPx: number;
  isActive: boolean;
  isOccurrence: boolean;
  percentage: number;
  isUrgent: boolean;
  isWarning: boolean;
  titleColor: string;
  timeColor: string;
  progressColorClass: string;
}

/**
 * AdaptiveTaskBlockContent
 * מרנדר תוכן בלוק משימה בהתאם ל-mode.
 * לא מגדיר position/size — רק תוכן פנימי.
 */
export const AdaptiveTaskBlockContent = ({
  mode,
  title,
  startStr,
  endStr,
  actualHeightPx,
  isActive,
  isOccurrence,
  percentage,
  isUrgent,
  isWarning: _isWarning,
  titleColor,
  timeColor,
  progressColorClass,
}: AdaptiveTaskBlockContentProps) => {
  const fontSize = getAdaptiveFontSize(actualHeightPx, mode);
  const padding  = getAdaptivePadding(actualHeightPx, mode);

  return (
    <>
      {/* ── Content area ─────────────────────────────────────────── */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-center overflow-hidden leading-none',
          padding,
        )}
        dir="rtl"
        style={{ minWidth: 0 }}
      >

        {/* ─── micro (1–5 min): שם בלבד ───────────────────────────── */}
        {mode === 'micro' && (
          <div className="flex items-center w-full min-w-0 overflow-hidden">
            {isOccurrence && (
              <Repeat className="w-2 h-2 flex-shrink-0 ml-0.5" />
            )}
            <span
              className={cn(
                fontSize,
                'font-semibold truncate leading-none min-w-0',
                titleColor,
              )}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {title}
            </span>
          </div>
        )}

        {/* ─── tiny (6–15 min): שעת התחלה + שם ───────────────────── */}
        {mode === 'tiny' && (
          <div className="flex items-center gap-0.5 w-full min-w-0 overflow-hidden">
            <span
              dir="ltr"
              className={cn(
                fontSize,
                'flex-shrink-0 tabular-nums font-medium leading-none',
                timeColor,
              )}
            >
              {startStr}
            </span>
            <span className={cn(fontSize, 'text-current/40 flex-shrink-0 leading-none mx-0.5')}>·</span>
            {isOccurrence && (
              <Repeat className="w-2 h-2 flex-shrink-0 ml-0.5" />
            )}
            <span
              className={cn(
                fontSize,
                'font-semibold truncate leading-none min-w-0 flex-1',
                titleColor,
              )}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {title}
            </span>
          </div>
        )}

        {/* ─── compact (16–45 min): שם + שעות בשורה אחת ──────────── */}
        {mode === 'compact' && (
          <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden">
            <span
              className={cn(
                fontSize,
                'font-semibold truncate flex-1 min-w-0 leading-none',
                titleColor,
              )}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {isOccurrence && <Repeat className="w-2 h-2 inline-block ml-0.5" />}
              {title}
            </span>
            <span
              dir="ltr"
              className={cn(
                fontSize,
                'flex-shrink-0 whitespace-nowrap tabular-nums leading-none font-medium',
                timeColor,
              )}
            >
              {startStr}–{endStr}
            </span>
          </div>
        )}

        {/* ─── full (>45 min): שם + שעות בשתי שורות ──────────────── */}
        {mode === 'full' && (
          <>
            <div className="flex items-start justify-between gap-1 min-w-0">
              <p
                className={cn(
                  fontSize,
                  'font-semibold truncate flex-1 min-w-0',
                  titleColor,
                )}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {isOccurrence && <Repeat className="w-3 h-3 inline-block ml-1" />}
                {title}
              </p>
              {isActive && actualHeightPx > 60 && (
                <p
                  className={cn(
                    'text-base font-bold tabular-nums flex-shrink-0',
                    isUrgent ? 'text-destructive' : 'text-primary-foreground',
                  )}
                >
                  {Math.round(percentage)}%
                </p>
              )}
            </div>
            <p dir="ltr" className={cn('text-[10px] mt-0.5 tabular-nums', timeColor)}>
              {startStr} – {endStr}
            </p>
          </>
        )}
      </div>

      {/* ── Progress bar (full mode, active task only) ───────────── */}
      {isActive && mode === 'full' && actualHeightPx > 30 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/20">
          <motion.div
            className={cn('h-full', progressColorClass)}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}
    </>
  );
};

export default AdaptiveTaskBlockContent;
